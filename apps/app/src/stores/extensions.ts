import { computed, ref, shallowRef, triggerRef } from 'vue'
import { defineStore } from 'pinia'
import type { PreferenceSnapshot, RemoteSource, SourceInfo } from '@mirai/extension-runtime'
import { fetchRepoIndex, normalizeRepoUrl, type RepoEntry } from '@/services/extensionRepo.service'
import {
  dropBundles,
  dropPrefs,
  readInstalled,
  readPrefs,
  readRepos,
  readShowNsfw,
  writeInstalled,
  writePrefs,
  writeRepos,
  writeShowNsfw,
  type InstalledRecord,
  type RepoRecord,
} from '@/services/extensionStorage.service'
import { activate, compatibilityError, type LoadedExtension } from '@/services/extensions.service'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Repo yang otomatis terdaftar saat pengembangan: hasil
 * `pnpm --filter @mirai/extensions build` yang disajikan Vite dari origin yang
 * sama. Sengaja cuma *terdaftar*, tidak ada satu pun paket yang dipasang
 * otomatis — kalau dipasang otomatis, jalur "tambah repo → pasang" yang dipakai
 * pengguna sungguhan tidak pernah dicoba selama pengembangan.
 */
const DEV_REPO = { url: '/ext-dev', name: 'Repo pengembangan' }

/** Satu paket yang sedang diinstal/di-update; dipakai UI untuk mengunci tombol. */
export type Busy = Record<string, boolean>

export interface ExtensionView {
  entry: RepoEntry
  repoUrl: string
  installed: InstalledRecord | undefined
  /** Versi di repo lebih baru daripada yang terpasang. */
  updatable: boolean
  /** Alasan paket tidak bisa dipasang, kalau ada. */
  incompatible: string | undefined
}

export const useExtensionsStore = defineStore('extensions', () => {
  const repos = ref<RepoRecord[]>([])
  const installed = ref<InstalledRecord[]>([])
  const showNsfw = ref(false)

  /** Isi `index.min.json` tiap repo, dipetakan dari URL repo-nya. */
  const catalog = ref<Record<string, RepoEntry[]>>({})
  const repoError = ref<Record<string, string>>({})

  // shallowRef, bukan ref: isinya instance kelas yang memegang Worker. Proxy
  // reaktif Vue akan membungkus method-nya dan merusak identitas objek yang
  // dikirim lewat postMessage.
  const loaded = shallowRef(new Map<string, LoadedExtension>())

  const state = ref<LoadState>('idle')
  const error = ref<string | null>(null)
  const busy = ref<Busy>({})

  // --- Turunan ---------------------------------------------------------------

  const sources = computed<RemoteSource[]>(() =>
    installed.value
      .filter((record) => record.enabled)
      .flatMap((record) => loaded.value.get(record.pkg)?.sources ?? [])
      .filter((source) => showNsfw.value || !source.info.isNsfw),
  )

  function byId(id: string): RemoteSource | undefined {
    return sources.value.find((source) => source.id === id)
  }

  function installedOf(pkg: string): InstalledRecord | undefined {
    return installed.value.find((record) => record.pkg === pkg)
  }

  /**
   * Gabungan katalog repo dan paket terpasang.
   *
   * Paket yang terpasang tetap muncul walau repo asalnya sedang tidak terbaca —
   * offline, repo dihapus, atau server mati. Kalau tidak, extension yang jelas-
   * jelas masih jalan akan lenyap dari halamannya sendiri.
   */
  const view = computed<ExtensionView[]>(() => {
    const rows = new Map<string, ExtensionView>()

    for (const [repoUrl, entries] of Object.entries(catalog.value)) {
      for (const entry of entries) {
        const record = installedOf(entry.pkg)
        rows.set(entry.pkg, {
          entry,
          repoUrl,
          installed: record,
          updatable: record !== undefined && isNewer(entry.version, record.entry.version),
          incompatible: compatibilityError(entry),
        })
      }
    }

    for (const record of installed.value) {
      if (rows.has(record.pkg)) continue
      rows.set(record.pkg, {
        entry: record.entry,
        repoUrl: record.repoUrl,
        installed: record,
        updatable: false,
        incompatible: compatibilityError(record.entry),
      })
    }

    return [...rows.values()]
      .filter((row) => showNsfw.value || !row.entry.nsfw)
      .sort((a, b) => a.entry.name.localeCompare(b.entry.name))
  })

  /** Skema setelan paket, digabung dari semua source di dalamnya. */
  function preferenceSchema(pkg: string): SourceInfo['preferences'] {
    const infos = loaded.value.get(pkg)?.sources.map((source) => source.info) ?? []
    const merged = new Map<string, SourceInfo['preferences'][number]>()
    for (const info of infos) {
      for (const preference of info.preferences) {
        if (!merged.has(preference.key)) merged.set(preference.key, preference)
      }
    }
    return [...merged.values()]
  }

  function preferenceValues(pkg: string): PreferenceSnapshot {
    return readPrefs(pkg)
  }

  // --- Siklus hidup ----------------------------------------------------------

  async function init(): Promise<void> {
    if (state.value !== 'idle') return
    state.value = 'loading'

    repos.value = readRepos()
    installed.value = readInstalled()
    showNsfw.value = readShowNsfw()

    if (import.meta.env.DEV && !repos.value.some((repo) => repo.url === DEV_REPO.url)) {
      repos.value = [...repos.value, { ...DEV_REPO, addedAt: Date.now() }]
      writeRepos(repos.value)
    }

    // Extension dinyalakan dari cache lebih dulu, tanpa menunggu jaringan:
    // membuka app di pesawat harus tetap menampilkan sumber yang terpasang.
    await Promise.all(installed.value.filter((record) => record.enabled).map(load))

    state.value = 'ready'
    await refreshAll()
  }

  async function load(record: InstalledRecord): Promise<void> {
    try {
      const extension = await activate(record, readPrefs(record.pkg))
      loaded.value.set(record.pkg, extension)
      triggerRef(loaded)
    } catch (cause) {
      // Satu extension rusak tidak boleh mengosongkan seluruh daftar.
      error.value = `${record.entry.name} gagal dimuat: ${messageOf(cause)}`
    }
  }

  function unload(pkg: string): void {
    loaded.value.get(pkg)?.instance.terminate()
    loaded.value.delete(pkg)
    triggerRef(loaded)
  }

  // --- Repo ------------------------------------------------------------------

  async function refreshRepo(url: string): Promise<void> {
    try {
      catalog.value[url] = await fetchRepoIndex(url)
      delete repoError.value[url]
    } catch (cause) {
      repoError.value[url] = messageOf(cause)
    }
  }

  async function refreshAll(): Promise<void> {
    await Promise.all(repos.value.map((repo) => refreshRepo(repo.url)))
  }

  async function addRepo(input: string): Promise<void> {
    const url = normalizeRepoUrl(input)
    if (repos.value.some((repo) => repo.url === url)) {
      throw new Error('Repo itu sudah ada di daftar')
    }

    // Index diambil **sebelum** disimpan: repo yang salah ketik langsung gagal
    // dengan pesannya sendiri, bukan mengendap jadi baris merah permanen.
    const entries = await fetchRepoIndex(url)

    repos.value = [...repos.value, { url, name: repoName(url), addedAt: Date.now() }]
    writeRepos(repos.value)
    catalog.value[url] = entries
  }

  /**
   * Menghapus repo tidak mencopot extension yang sudah dipasang darinya: kode-
   * nya ada di cache dan masih jalan. Yang hilang cuma jalur update-nya, dan itu
   * ditandai di UI.
   */
  function removeRepo(url: string): void {
    repos.value = repos.value.filter((repo) => repo.url !== url)
    writeRepos(repos.value)
    delete catalog.value[url]
    delete repoError.value[url]
  }

  // --- Pasang / copot --------------------------------------------------------

  async function withBusy(pkg: string, work: () => Promise<void>): Promise<void> {
    if (busy.value[pkg]) return
    busy.value = { ...busy.value, [pkg]: true }
    error.value = null
    try {
      await work()
    } catch (cause) {
      error.value = messageOf(cause)
    } finally {
      const next = { ...busy.value }
      delete next[pkg]
      busy.value = next
    }
  }

  async function install(entry: RepoEntry, repoUrl: string): Promise<void> {
    await withBusy(entry.pkg, async () => {
      const incompatible = compatibilityError(entry)
      if (incompatible) throw new Error(`${entry.name}: ${incompatible}`)

      const record: InstalledRecord = {
        pkg: entry.pkg,
        repoUrl,
        entry,
        enabled: true,
        installedAt: Date.now(),
      }

      // Dimuat dulu, baru dicatat: paket yang gagal dijalankan tidak pantas
      // tampil sebagai "terpasang" di daftar.
      const extension = await activate(record, readPrefs(entry.pkg))
      loaded.value.set(entry.pkg, extension)
      triggerRef(loaded)

      installed.value = [...installed.value.filter((item) => item.pkg !== entry.pkg), record]
      writeInstalled(installed.value)
    })
  }

  /**
   * Versi lama sengaja dibiarkan hidup sampai yang baru benar-benar jalan.
   * Update yang gagal — repo mati, bundel rusak — tidak boleh meninggalkan
   * pengguna tanpa sumber yang tadinya baik-baik saja.
   */
  async function update(pkg: string): Promise<void> {
    const row = view.value.find((item) => item.entry.pkg === pkg)
    if (!row?.installed) return

    const previous = loaded.value.get(pkg)
    await install(row.entry, row.repoUrl)

    if (installedOf(pkg)?.entry.version !== row.entry.version) return
    previous?.instance.terminate()
    await dropBundles(pkg, row.entry.version)
  }

  async function uninstall(pkg: string): Promise<void> {
    unload(pkg)
    installed.value = installed.value.filter((record) => record.pkg !== pkg)
    writeInstalled(installed.value)
    dropPrefs(pkg)
    await dropBundles(pkg)
  }

  async function setEnabled(pkg: string, enabled: boolean): Promise<void> {
    const record = installedOf(pkg)
    if (!record) return

    installed.value = installed.value.map((item) =>
      item.pkg === pkg ? { ...item, enabled } : item,
    )
    writeInstalled(installed.value)

    // Dimatikan berarti Worker-nya benar-benar dihentikan, bukan sekadar
    // disembunyikan: extension yang tidak dipakai tidak boleh memegang memori
    // atau menembak jaringan.
    if (enabled) await load({ ...record, enabled })
    else unload(pkg)
  }

  /**
   * Setelan hanya sampai ke source lewat `SourceContext` waktu factory dipanggil,
   * jadi menyimpannya berarti menjalankan ulang Worker-nya. Itu memang mahal,
   * tapi alternatifnya adalah setelan yang baru berlaku setelah app di-restart.
   */
  async function savePreferences(pkg: string, prefs: PreferenceSnapshot): Promise<void> {
    writePrefs(pkg, prefs)
    const record = installedOf(pkg)
    if (!record?.enabled) return

    await withBusy(pkg, async () => {
      const previous = loaded.value.get(pkg)
      await load(record)
      // `load` menelan errornya sendiri; kalau peta tidak berubah berarti yang
      // baru gagal dan yang lama masih yang dipakai.
      if (loaded.value.get(pkg) !== previous) previous?.instance.terminate()
    })
  }

  function setShowNsfw(value: boolean): void {
    showNsfw.value = value
    writeShowNsfw(value)
  }

  /** Halaman boleh memanggilnya tanpa saling menunggu. */
  async function ensureLoaded(): Promise<void> {
    if (state.value === 'idle') await init()
  }

  return {
    repos,
    installed,
    catalog,
    repoError,
    showNsfw,
    state,
    error,
    busy,
    sources,
    view,
    byId,
    installedOf,
    preferenceSchema,
    preferenceValues,
    init,
    ensureLoaded,
    refreshAll,
    refreshRepo,
    addRepo,
    removeRepo,
    install,
    update,
    uninstall,
    setEnabled,
    savePreferences,
    setShowNsfw,
  }
})

// --- Helper ------------------------------------------------------------------

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/** Nama repo dari host-nya; cukup untuk membedakan dua baris di daftar. */
function repoName(url: string): string {
  if (url.startsWith('/')) return url
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * Perbandingan SemVer seadanya — cukup untuk membandingkan dua versi paket dari
 * repo yang sama. Sufiks pra-rilis diabaikan; repo extension tidak memakainya.
 */
function isNewer(candidate: string, current: string): boolean {
  const parse = (value: string): number[] =>
    value.split('.').map((part) => Number.parseInt(part, 10) || 0)

  const a = parse(candidate)
  const b = parse(current)

  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index] ?? 0
    const right = b[index] ?? 0
    if (left !== right) return left > right
  }
  return false
}
