import type { PreferenceSnapshot } from '@mirai/extension-runtime'
import type { RepoEntry } from './extensionRepo.service'

/**
 * Penyimpanan lokal untuk daftar repo, extension terpasang, dan setelannya.
 *
 * Dua medium, sengaja dipisah berdasarkan ukuran: metadata (kecil, sering
 * dibaca sinkron waktu boot) di `localStorage`, bundel kode (±275 KB per paket,
 * cukup untuk meledakkan kuota 5 MB localStorage setelah belasan extension) di
 * Cache API.
 *
 * Semua pembacaan memaafkan data rusak. Setelan yang gagal di-parse berarti app
 * gagal dibuka sama sekali, dan itu harga yang jauh lebih mahal daripada satu
 * repo yang hilang.
 */

const KEY_REPOS = 'mirai.extensions.repos'
const KEY_INSTALLED = 'mirai.extensions.installed'
const KEY_PREFS = 'mirai.extensions.prefs'
const KEY_SHOW_NSFW = 'mirai.extensions.showNsfw'

/** Nama cache diberi versi supaya perubahan format bundel bisa membuang isinya. */
const BUNDLE_CACHE = 'mirai-extensions-v1'

export interface RepoRecord {
  url: string
  name: string
  addedAt: number
}

export interface InstalledRecord {
  pkg: string
  /** Repo asalnya; dipakai untuk mengunduh ulang dan mencari update. */
  repoUrl: string
  /** Salinan entri repo saat dipasang — supaya daftar tetap lengkap saat offline. */
  entry: RepoEntry
  enabled: boolean
  installedAt: number
}

// --- localStorage ------------------------------------------------------------

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Mode privat sebagian browser menolak menulis. Kehilangan daftar setelah
    // reload lebih baik daripada aksi pengguna yang gagal dengan exception.
  }
}

export function readRepos(): RepoRecord[] {
  return readJson<RepoRecord[]>(KEY_REPOS, []).filter((repo) => typeof repo?.url === 'string')
}

export function writeRepos(repos: RepoRecord[]): void {
  writeJson(KEY_REPOS, repos)
}

export function readInstalled(): InstalledRecord[] {
  return readJson<InstalledRecord[]>(KEY_INSTALLED, []).filter(
    (record) => typeof record?.pkg === 'string' && typeof record.entry?.file === 'string',
  )
}

export function writeInstalled(records: InstalledRecord[]): void {
  writeJson(KEY_INSTALLED, records)
}

export function readShowNsfw(): boolean {
  return readJson<boolean>(KEY_SHOW_NSFW, false) === true
}

export function writeShowNsfw(value: boolean): void {
  writeJson(KEY_SHOW_NSFW, value)
}

/**
 * Setelan bersifat per **paket**, bukan per source: worker menerima satu
 * `PreferenceStore` untuk seluruh factory, jadi dua source dalam satu paket
 * memang berbagi ruang kunci. Itu batas kontrak `SourceContext`, bukan
 * penyederhanaan di lapisan ini.
 */
export function readPrefs(pkg: string): PreferenceSnapshot {
  return readJson<PreferenceSnapshot>(`${KEY_PREFS}.${pkg}`, {})
}

export function writePrefs(pkg: string, prefs: PreferenceSnapshot): void {
  writeJson(`${KEY_PREFS}.${pkg}`, prefs)
}

export function dropPrefs(pkg: string): void {
  try {
    localStorage.removeItem(`${KEY_PREFS}.${pkg}`)
  } catch {
    // Sama seperti writeJson: gagal menghapus tidak boleh membatalkan uninstall.
  }
}

// --- Cache API ---------------------------------------------------------------

/**
 * Kunci cache memuat versi, jadi update tidak pernah menyajikan kode lama dan
 * downgrade tetap menemukan bundelnya kalau kebetulan masih ada.
 */
function bundleKey(pkg: string, version: string): string {
  return `https://extensions.mirai.invalid/${encodeURIComponent(pkg)}/${encodeURIComponent(version)}.js`
}

/** Cache API absen di konteks non-secure dan sebagian WebView lama. */
async function openBundleCache(): Promise<Cache | undefined> {
  if (typeof caches === 'undefined') return undefined
  try {
    return await caches.open(BUNDLE_CACHE)
  } catch {
    return undefined
  }
}

export async function readBundle(pkg: string, version: string): Promise<string | undefined> {
  const cache = await openBundleCache()
  const hit = await cache?.match(bundleKey(pkg, version))
  return hit ? await hit.text() : undefined
}

export async function writeBundle(pkg: string, version: string, code: string): Promise<void> {
  const cache = await openBundleCache()
  await cache?.put(
    bundleKey(pkg, version),
    new Response(code, { headers: { 'Content-Type': 'text/javascript' } }),
  )
}

/** Membuang semua versi satu paket; dipanggil saat uninstall dan setelah update. */
export async function dropBundles(pkg: string, keepVersion?: string): Promise<void> {
  const cache = await openBundleCache()
  if (!cache) return

  const prefix = bundleKey(pkg, '').replace(/\.js$/, '')
  const keep = keepVersion === undefined ? undefined : bundleKey(pkg, keepVersion)

  for (const request of await cache.keys()) {
    if (request.url.startsWith(prefix) && request.url !== keep) await cache.delete(request)
  }
}
