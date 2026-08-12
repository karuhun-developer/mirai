import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import type {
  AnySource,
  HttpClient,
  PreferenceStore,
  SourceContext,
  SourceFactory,
} from '@mirai/extension-api'

/**
 * Membangun repo extension: satu berkas ESM mandiri per paket, ikonnya, dan
 * `index.min.json` yang dibaca aplikasi.
 *
 * `@mirai/extension-lib` sengaja ikut dibundel (bukan di-external): berkas
 * hasilnya dijalankan di Worker lewat blob URL, yang tidak punya resolver modul
 * — apa pun yang tersisa sebagai `import` di situ akan gagal saat dimuat.
 *
 * Hasil build juga diperiksa di sini, bukan dibiarkan gagal di HP pengguna:
 * bundelnya benar-benar dijalankan sekali untuk mengumpulkan daftar source-nya.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')
const outDir = join(root, 'dist')

/** SVG didahulukan: ukurannya kecil dan tetap tajam di layar kepadatan berapa pun. */
const ICON_FILES = ['icon.svg', 'icon.png']

interface Manifest {
  pkg: string
  name: string
  lang: string
  version: string
  apiVersion: number
  nsfw: boolean
  hosts: string[]
}

/** Ringkasan satu source di dalam paket; dipakai UI sebelum extension dipasang. */
interface RepoSource {
  id: string
  name: string
  lang: string
  kind: 'manga' | 'anime'
  baseUrl: string
  supportsLatest: boolean
  nsfw: boolean
}

interface RepoEntry extends Manifest {
  file: string
  icon?: string
  sources: RepoSource[]
}

// --- Manifest ---------------------------------------------------------------

/**
 * Manifest ditulis tangan, jadi bentuknya tidak dijamin apa pun. Memvalidasinya
 * di sini membuat salah ketik gagal saat build dengan nama berkasnya, bukan
 * jadi `undefined` yang menyebar sampai ke index repo.
 */
function parseManifest(path: string, raw: string): Manifest {
  const data: unknown = JSON.parse(raw)
  if (typeof data !== 'object' || data === null) throw new Error(`${path}: bukan objek JSON`)
  const record = data as Record<string, unknown>

  const text = (key: string): string => {
    const value = record[key]
    if (typeof value !== 'string' || !value) throw new Error(`${path}: "${key}" wajib diisi`)
    return value
  }

  const hosts = record['hosts']
  if (!Array.isArray(hosts) || hosts.some((host) => typeof host !== 'string')) {
    throw new Error(`${path}: "hosts" wajib berupa daftar hostname`)
  }
  if (hosts.length === 0) {
    // Tanpa host, proxy menolak semua request source ini dan gejalanya muncul
    // jauh kemudian sebagai "sumber tidak bisa dihubungi".
    throw new Error(`${path}: "hosts" kosong — proxy akan menolak semua request source ini`)
  }

  const apiVersion = record['apiVersion']
  if (typeof apiVersion !== 'number') throw new Error(`${path}: "apiVersion" wajib berupa angka`)

  return {
    pkg: text('pkg'),
    name: text('name'),
    lang: text('lang'),
    version: text('version'),
    apiVersion,
    nsfw: record['nsfw'] === true,
    hosts: hosts as string[],
  }
}

async function collect(): Promise<{ dir: string; manifest: Manifest }[]> {
  const found: { dir: string; manifest: Manifest }[] = []

  for (const lang of await readdir(srcDir, { withFileTypes: true })) {
    if (!lang.isDirectory()) continue
    const langDir = join(srcDir, lang.name)

    for (const slug of await readdir(langDir, { withFileTypes: true })) {
      if (!slug.isDirectory()) continue
      const dir = join(langDir, slug.name)
      const path = join(dir, 'manifest.json')
      found.push({ dir, manifest: parseManifest(path, await readFile(path, 'utf8')) })
    }
  }

  return found.sort((a, b) => a.manifest.pkg.localeCompare(b.manifest.pkg))
}

// --- Pemeriksaan hasil build ------------------------------------------------

/**
 * Konteks palsu untuk memanggil factory sekali di sini. Semua metode HTTP-nya
 * melempar: constructor source memang tidak boleh melakukan I/O — kalau boleh,
 * memasang extension akan menembak jaringan sebelum pengguna meminta apa pun.
 */
function stubContext(apiVersion: number): SourceContext {
  const fail = (): never => {
    throw new Error('constructor source tidak boleh melakukan HTTP')
  }

  const http: HttpClient = { request: fail, get: fail, post: fail, getJson: fail }
  const preferences: PreferenceStore = {
    getString: (_key, fallback) => fallback,
    getBoolean: (_key, fallback) => fallback,
    getStringList: (_key, fallback) => [...fallback],
  }

  return { apiVersion, http, preferences }
}

function toRepoSource(source: AnySource, fallbackNsfw: boolean): RepoSource {
  return {
    id: source.id,
    name: source.name,
    lang: source.lang,
    kind: source.kind,
    baseUrl: source.baseUrl,
    supportsLatest: source.supportsLatest,
    nsfw: source.isNsfw || fallbackNsfw,
  }
}

/**
 * Menjalankan bundel yang baru dibangun untuk mengumpulkan source-nya.
 *
 * Kode extension dieksekusi penuh di proses build ini — aman karena yang
 * dibangun adalah isi repo ini sendiri, bukan paket kiriman orang. Imbalannya
 * besar: "lupa `export default`" dan "factory mengembalikan array kosong"
 * ketahuan di CI, bukan sebagai layar kosong di HP pengguna. Nilainya memakai
 * preferensi bawaan, jadi `baseUrl` di index adalah domain default source.
 */
async function describeSources(outfile: string, manifest: Manifest): Promise<RepoSource[]> {
  const module = (await import(pathToFileURL(outfile).href)) as { default?: unknown }
  const factory = module.default

  if (typeof factory !== 'function') {
    throw new Error(`${manifest.pkg}: wajib \`export default\` sebuah SourceFactory`)
  }

  const produced = (factory as SourceFactory)(stubContext(manifest.apiVersion))
  if (!Array.isArray(produced) || produced.length === 0) {
    throw new Error(`${manifest.pkg}: SourceFactory tidak mengembalikan satu source pun`)
  }

  for (const source of produced) {
    if (!source.id || !source.name) throw new Error(`${manifest.pkg}: source tanpa id atau nama`)
    assertHostListed(manifest, source.baseUrl, `baseUrl ${source.name}`)
  }

  return produced.map((source) => toRepoSource(source, manifest.nsfw))
}

/**
 * Host di luar `hosts[]` ditolak proxy dengan 403. Memeriksanya di build
 * menutup penyebab paling sering dari "judulnya muncul tapi cover-nya kosong".
 */
function assertHostListed(manifest: Manifest, url: string, what: string): void {
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    throw new Error(`${manifest.pkg}: ${what} bukan URL yang sah — ${url}`)
  }

  const covered = manifest.hosts.some((host) => {
    const listed = host.toLowerCase()
    return hostname === listed || hostname.endsWith(`.${listed}`)
  })

  if (!covered) {
    throw new Error(`${manifest.pkg}: ${what} (${hostname}) tidak ada di "hosts" manifest`)
  }
}

// --- Build ------------------------------------------------------------------

const extensions = await collect()
if (extensions.length === 0) throw new Error('Tidak ada extension di extensions/src')

await rm(outDir, { recursive: true, force: true })
await mkdir(join(outDir, 'js'), { recursive: true })
await mkdir(join(outDir, 'icon'), { recursive: true })

const index: RepoEntry[] = []
const seenSourceIds = new Map<string, string>()

for (const { dir, manifest } of extensions) {
  const outfile = join(outDir, 'js', `${manifest.pkg}.js`)

  await build({
    entryPoints: [join(dir, 'index.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    // Sourcemap dilepas ke berkas terpisah supaya stack trace dari worker masih
    // bisa dibaca tanpa menggemukkan bundel yang diunduh pengguna.
    sourcemap: 'linked',
    legalComments: 'none',
  })

  const sources = await describeSources(outfile, manifest)

  for (const source of sources) {
    // Id source adalah kunci entri di library pengguna. Dua paket dengan id yang
    // sama akan saling mencuri entri, jadi tabrakannya harus mati di sini.
    const owner = seenSourceIds.get(source.id)
    if (owner) throw new Error(`Source id "${source.id}" dipakai ${owner} dan ${manifest.pkg}`)
    seenSourceIds.set(source.id, manifest.pkg)
  }

  const iconName = ICON_FILES.find((name) => existsSync(join(dir, name)))
  let icon: string | undefined
  if (iconName) {
    icon = `icon/${manifest.pkg}${extname(iconName)}`
    await copyFile(join(dir, iconName), join(outDir, icon))
  }

  index.push({ ...manifest, file: `js/${manifest.pkg}.js`, ...(icon ? { icon } : {}), sources })

  const labels = sources.map((source) => `${source.name} (${source.kind})`).join(', ')
  console.log(`✓ ${manifest.pkg} v${manifest.version} — ${labels}`)
}

await writeFile(join(outDir, 'index.min.json'), JSON.stringify(index), 'utf8')
console.log(`\n${index.length} paket, ${seenSourceIds.size} source → extensions/dist`)
