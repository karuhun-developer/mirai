import type { SPage } from '@mirai/extension-api'
import type { RemoteAnimeSource, RemoteMangaSource, RemoteSource } from '@mirai/extension-runtime'
import type { DownloadEntry, DownloadRow, EntryRow, ItemRow } from '@mirai/db'
import { toSItem } from '@mirai/db'
import { repos } from './db.service'
import { isLocalUrl, mediaUrl, transport } from './extensions.service'
import { entryDir, itemDir, pageFileName, videoFileName } from './downloadPath'
import { PLAYLIST_NAME, isMasterPlaylist, parseVariants, planPlaylist } from './hlsPlaylist'
import { SUBTITLES_NAME, type LocalTrackFile } from './localMedia'
import { pickVideo, type PlayableVideo } from './playback'
import { loadVideos, readPlayerPrefs } from './player.service'
import {
  downloadFile,
  listDir,
  removeDir,
  requestPersistence,
  storageEstimate,
  writeText,
} from './storage.service'
import { storageStatus, type StorageStatus } from './storageQuota'
import { toVtt } from './subtitle'

/**
 * Antrean unduhan.
 *
 * Keadaannya tinggal di **database**, bukan di store: aplikasi yang ditutup di
 * tengah unduhan harus melanjutkan sendiri waktu dibuka lagi, dan itu cuma
 * mungkin kalau daftar pekerjaannya selamat dari reload. Yang di modul ini cuma
 * pekerjanya — berapa yang sedang jalan, dan mana yang diminta berhenti.
 *
 * Kenapa pekerjanya modul, bukan store: unduhan tidak boleh berhenti waktu
 * halaman Unduhan ditutup. Store bisa dibuang router kapan saja; modul hidup
 * selama tab-nya hidup. Store cuma jadi wajah reaktifnya lewat `onChange`.
 *
 * Chapter dan episode lewat antrean yang sama persis; yang berbeda cuma isi
 * pekerjaannya (`downloadChapter` vs `downloadEpisode`). Kenapa modul ini yang
 * memanggil `player.service` dan bukan sebaliknya: daftar video satu episode
 * ditentukan aturan yang sama untuk menonton dan mengunduh — termasuk kualitas
 * pilihan pengguna — dan menyalinnya ke sini berarti dua aturan yang lambat laun
 * berbeda.
 */

// ── Setelan ──────────────────────────────────────────────────────────────────

export interface DownloadPrefs {
  /** Berapa chapter diunduh berbarengan. Halamannya sendiri selalu berurutan. */
  concurrency: number
  /** Hapus berkasnya begitu chapternya selesai dibaca. */
  deleteAfterRead: boolean
}

export const defaultDownloadPrefs: DownloadPrefs = {
  concurrency: 2,
  deleteAfterRead: false,
}

const PREFS_KEY = 'downloads.prefs'

let prefs: DownloadPrefs = { ...defaultDownloadPrefs }

export async function readDownloadPrefs(): Promise<DownloadPrefs> {
  const stored = await repos().settings.getJson<Partial<DownloadPrefs>>(PREFS_KEY, {})
  prefs = {
    ...defaultDownloadPrefs,
    ...stored,
    concurrency: clamp(stored.concurrency ?? defaultDownloadPrefs.concurrency, 1, 4),
  }
  return { ...prefs }
}

export async function writeDownloadPrefs(patch: Partial<DownloadPrefs>): Promise<DownloadPrefs> {
  prefs = { ...prefs, ...patch, concurrency: clamp(patch.concurrency ?? prefs.concurrency, 1, 4) }
  await repos().settings.setJson(PREFS_KEY, prefs)
  // Menaikkan angkanya berarti boleh langsung ada pekerja tambahan.
  void pump()
  return { ...prefs }
}

// ── Keadaan pekerja ──────────────────────────────────────────────────────────

type Resolver = (sourceId: string) => RemoteSource | undefined

let resolveSource: Resolver = () => undefined
let changed: () => void = () => {}

let workers = 0
let pumping = false
let pumpAgain = false

/**
 * Pekerjaan yang diminta berhenti di tengah jalan.
 *
 * Unduhan satu chapter itu belasan sampai ratusan permintaan berurutan; kalau
 * "jeda" cuma mengubah baris database, halaman yang sedang jalan tetap turun
 * sampai habis dan tombolnya terasa tidak menekan apa-apa. Set ini yang dibaca
 * di sela tiap halaman.
 */
const stopping = new Set<string>()

/** Pekerjaan yang sedang dikerjakan pekerja di tab ini. */
const runningIds = new Set<string>()

/** Penanda berhenti karena diminta — dibedakan dari gagal supaya tidak jadi error merah. */
const STOPPED = Symbol('stopped')

export interface DownloadHooks {
  /** Extension mana yang punya sumbernya; dipasok store extension. */
  resolve: Resolver
  /** Dipanggil tiap kali daftar atau progres berubah. */
  onChange: () => void
}

export function configureDownloads(hooks: DownloadHooks): void {
  resolveSource = hooks.resolve
  changed = hooks.onChange
}

/**
 * Dipanggil sekali waktu aplikasi hidup.
 *
 * `requeueRunning()` wajib duluan: baris yang tertinggal `running` waktu tab
 * ditutup tidak punya siapa-siapa yang mengerjakannya lagi, dan tanpa
 * dipulangkan ke antrean ia menggantung selamanya dengan progres beku.
 */
export async function bootDownloads(): Promise<void> {
  await readDownloadPrefs()
  await repos().downloads.requeueRunning()
  changed()
  void pump()
}

// ── Antrean ──────────────────────────────────────────────────────────────────

export async function enqueue(items: ItemRow[]): Promise<void> {
  if (items.length === 0) return

  // Diminta sekali saat orangnya menunjukkan niat menyimpan sesuatu, bukan waktu
  // app dibuka — dialog izin yang muncul tanpa sebab cuma ditolak orang.
  await requestPersistence()

  for (const item of items) await repos().downloads.enqueue(item.id, item.entry_id)
  changed()
  void pump()
}

export async function pauseAll(): Promise<void> {
  await repos().downloads.pauseAll()
  for (const id of runningIds) stopping.add(id)
  changed()
}

export async function resumeAll(): Promise<void> {
  await repos().downloads.resumeAll()
  changed()
  void pump()
}

/** Mengulang satu pekerjaan yang gagal atau terjeda. */
export async function retry(job: DownloadRow): Promise<void> {
  await repos().downloads.enqueue(job.item_id, job.entry_id)
  changed()
  void pump()
}

/**
 * Membuang satu pekerjaan beserta berkasnya.
 *
 * Satu fungsi untuk "batalkan" dan "hapus" karena keduanya berarti hal yang
 * persis sama di penyimpanan: hentikan kalau sedang jalan, buang direktorinya,
 * lupakan barisnya. Yang berbeda cuma label tombolnya, dan itu urusan UI.
 */
export async function removeJob(job: DownloadRow): Promise<void> {
  stopping.add(job.id)
  await repos().downloads.remove(job.id)
  const context = await contextOf(job.item_id)
  if (context) await removeFiles(context.entry, context.item)
  changed()
}

/** Membersihkan daftar dari yang sudah selesai. Berkasnya sengaja tetap ada. */
export async function clearDone(): Promise<void> {
  await repos().downloads.clearDone()
  changed()
}

export function listDownloads(limit?: number): Promise<DownloadEntry[]> {
  return repos().downloads.list(limit)
}

export function pendingCount(): Promise<number> {
  return repos().downloads.countPending()
}

/** Id chapter yang berkasnya sudah lengkap — dipakai menandai daftar chapter. */
export async function downloadedIds(entryId: string): Promise<Set<string>> {
  const rows = await repos().items.listDownloaded(entryId)
  return new Set(rows.map((row) => row.id))
}

// ── Pekerja ──────────────────────────────────────────────────────────────────

/**
 * Mengisi slot pekerja yang kosong.
 *
 * Dijaga `pumping` supaya dua pemanggil tidak sama-sama mengambil baris antrean
 * yang sama — jeda `await` antara "lihat antrean" dan "tandai berjalan" cukup
 * lebar untuk itu. Yang datang saat sedang berjalan tidak hilang: `pumpAgain`
 * membuat putaran diulang sekali lagi setelahnya.
 */
async function pump(): Promise<void> {
  if (pumping) {
    pumpAgain = true
    return
  }
  pumping = true

  try {
    do {
      pumpAgain = false
      while (workers < prefs.concurrency) {
        const job = await repos().downloads.nextQueued()
        if (!job) break

        await repos().downloads.setState(job.id, 'running')
        workers += 1
        runningIds.add(job.id)
        changed()

        void run(job).finally(() => {
          workers -= 1
          runningIds.delete(job.id)
          stopping.delete(job.id)
          changed()
          void pump()
        })
      }
    } while (pumpAgain)
  } finally {
    pumping = false
  }
}

async function run(job: DownloadRow): Promise<void> {
  const { downloads, items } = repos()

  try {
    const context = await contextOf(job.item_id)
    if (!context) throw new Error('Chapter ini sudah tidak ada di database.')

    const { entry, item } = context
    const source = resolveSource(entry.source_id)
    if (!source) {
      throw new Error(
        'Extension sumber judul ini tidak terpasang atau sedang dimatikan, jadi isinya tidak bisa diambil.',
      )
    }
    if (source.kind !== entry.kind) throw new Error(`Sumber ini bukan sumber ${entry.kind}.`)

    await guardStorage()

    const path =
      entry.kind === 'anime'
        ? await downloadEpisode(source as RemoteAnimeSource, entry, item, job.id)
        : await downloadChapter(source as RemoteMangaSource, entry, item, job.id)

    await items.setDownloaded([item.id], true)
    await downloads.setState(job.id, 'done', { progress: 100, path })
  } catch (cause) {
    if (cause === STOPPED) {
      // Barisnya sudah dijadikan 'paused' atau dihapus oleh yang menghentikan;
      // menimpanya di sini justru menghidupkan lagi pekerjaan yang dibatalkan.
      return
    }
    await downloads.setState(job.id, 'failed', { error: messageOf(cause) })
  }
}

/**
 * Mengunduh seluruh halaman satu chapter, berurutan.
 *
 * **Sengaja tidak paralel per halaman.** Situs sumber manga umumnya membatasi
 * laju permintaan, dan menembakkan 20 permintaan sekaligus adalah cara tercepat
 * kena 429 atau blokir IP. Yang paralel adalah chapternya (`concurrency`), yang
 * jumlahnya masih sopan.
 */
async function downloadChapter(
  source: RemoteMangaSource,
  entry: EntryRow,
  item: ItemRow,
  jobId: string,
): Promise<string> {
  const dir = itemDir(entry, item)
  const listed = fixturePages ?? (await source.getPageList(toSItem(item)))
  const pages = listed.filter((page) => typeof page.imageUrl === 'string' && page.imageUrl !== '')
  if (pages.length === 0) throw new Error('Sumber tidak mengembalikan satu halaman pun.')

  checkStop(jobId)

  // Melanjutkan yang tadi terputus: berkas yang sudah ada dilewati. Kecuali yang
  // paling belakang — halaman ditulis berurutan, jadi cuma berkas terakhir yang
  // mungkin separuh jadi waktu app dibunuh di tengah penulisan.
  const existing = new Set(await listDir(dir))
  const last = [...existing].sort().pop()
  if (last !== undefined) existing.delete(last)

  for (const [index, page] of pages.entries()) {
    checkStop(jobId)

    const name = pageFileName(index, page.imageUrl)
    if (!existing.has(name)) {
      await downloadFile(
        `${dir}/${name}`,
        page.imageUrl,
        mediaUrl(page.imageUrl, page.headers),
        page.headers,
      )
    }

    // Progresnya sengaja tanpa snapshot database (lihat `DownloadRepository`),
    // tapi tetap memberi tahu UI supaya bilahnya bergerak tiap halaman.
    await repos().downloads.setProgress(jobId, ((index + 1) / pages.length) * 100)
    changed()
  }

  return dir
}

/**
 * Mengunduh satu episode.
 *
 * Kualitasnya mengikuti setelan pemutar, bukan selalu yang tertinggi: orang yang
 * menonton di 480p demi kuota tidak mau unduhannya diam-diam 1080p. Host `embed`
 * dibuang di depan — isinya halaman pemutar pihak ketiga, bukan berkas video,
 * dan tidak ada yang bisa disimpan dari sana.
 */
async function downloadEpisode(
  source: RemoteAnimeSource,
  entry: EntryRow,
  item: ItemRow,
  jobId: string,
): Promise<string> {
  const dir = itemDir(entry, item)
  const videos = await loadVideos(source, item)
  const playable = videos.filter((video) => video.type !== 'embed')

  if (playable.length === 0) {
    throw new Error(
      videos.length === 0
        ? 'Sumber tidak mengembalikan satu video pun.'
        : 'Episode ini cuma tersedia lewat halaman pemutar pihak ketiga, yang tidak bisa diunduh.',
    )
  }

  const { quality } = await readPlayerPrefs()
  const video = playable[pickVideo(playable, quality)] ?? playable[0]
  if (!video) throw new Error('Tidak ada video yang bisa diunduh.')

  checkStop(jobId)

  if (video.type === 'hls') await downloadHls(video, quality, dir, jobId)
  else await downloadWhole(video, dir, jobId)

  await downloadSubtitles(video, dir)
  return dir
}

/**
 * Takarir ikut diunduh, dan sudah dikonversi ke WebVTT di sini.
 *
 * Untuk sebagian besar orang yang menonton di sini, episode tanpa takarir sama
 * saja dengan episode yang tidak bisa ditonton — jadi ini bukan pelengkap.
 * Konversinya dikerjakan sekarang, bukan saat memutar, karena `toVtt()` butuh
 * teks aslinya utuh dan berkas VTT yang sudah jadi bisa langsung dipasang ke
 * `<track>` walau perangkatnya sedang tanpa jaringan.
 *
 * Satu takarir yang gagal tidak menggagalkan episodenya: video yang sudah turun
 * ratusan megabita tidak boleh dibuang gara-gara satu berkas teks.
 */
async function downloadSubtitles(video: PlayableVideo, dir: string): Promise<void> {
  const catalog: LocalTrackFile[] = []

  for (const [index, track] of video.subtitles.entries()) {
    const name = `sub-${String(index + 1).padStart(2, '0')}.vtt`
    try {
      const response = await transport.http.get(track.url)
      if (!response.ok) continue

      await writeText(`${dir}/${name}`, toVtt(response.body))
      catalog.push({
        name,
        label: track.label,
        ...(track.lang === undefined ? {} : { lang: track.lang }),
      })
    } catch {
      // Idem: dicatat lewat ketiadaannya di katalog, bukan lewat error.
    }
  }

  if (catalog.length > 0) await writeText(`${dir}/${SUBTITLES_NAME}`, JSON.stringify(catalog))
}

/** Video satu berkas (mp4/mkv). Progresnya dari byte yang sudah turun. */
async function downloadWhole(video: PlayableVideo, dir: string, jobId: string): Promise<void> {
  const name = videoFileName(video.url)

  await downloadFile(
    `${dir}/${name}`,
    video.url,
    mediaUrl(video.url, video.headers),
    video.headers,
    (ratio) => {
      // Tanpa laporan byte, satu episode 300 MB berarti bilah progres yang
      // membeku di nol selama beberapa menit dan terlihat seperti macet.
      void repos().downloads.setProgress(jobId, ratio * 100)
      changed()
    },
  )
}

/**
 * Video HLS: playlist, seluruh segmennya, dan kunci AES-128-nya.
 *
 * Playlist ditulis **paling akhir**. Keberadaannya karena itu berarti "seluruh
 * segmennya sudah ada" — tanpa aturan itu, unduhan yang terputus di tengah
 * meninggalkan playlist utuh yang menunjuk ratusan berkas yang belum turun, dan
 * episodenya berhenti di tengah tanpa penjelasan.
 *
 * Segmennya sengaja berurutan, bukan paralel: alasannya sama dengan halaman
 * manga (lihat `downloadChapter`), ditambah satu lagi — satu episode bisa berisi
 * ratusan segmen, dan menembakkannya serentak adalah beda antara mengunduh dan
 * membanjiri.
 */
async function downloadHls(
  video: PlayableVideo,
  quality: string,
  dir: string,
  jobId: string,
): Promise<void> {
  let url = video.url
  let text = await fetchPlaylist(url, video.headers)

  if (isMasterPlaylist(text)) {
    const variants = parseVariants(text, url).map<PlayableVideo>((variant) => ({
      url: variant.url,
      quality: variant.quality,
      type: 'hls',
      ...(video.headers === undefined ? {} : { headers: video.headers }),
      subtitles: [],
    }))

    const chosen = variants[pickVideo(variants, quality)] ?? variants[0]
    if (!chosen) throw new Error('Master playlist ini tidak menawarkan satu kualitas pun.')

    url = chosen.url
    text = await fetchPlaylist(url, video.headers)
    // Master yang menunjuk master lagi bukan bentuk yang wajar; lebih baik gagal
    // dengan jelas daripada menelusuri rantai yang tidak ada ujungnya.
    if (isMasterPlaylist(text)) throw new Error('Playlist HLS ini bertingkat terlalu dalam.')
  }

  const plan = planPlaylist(text, url)
  if (plan.resources.length === 0) throw new Error('Playlist HLS ini tidak berisi satu segmen pun.')

  // Melanjutkan yang terputus, aturannya sama dengan halaman manga: yang sudah
  // ada dilewati kecuali berkas terakhir, yang mungkin separuh tertulis. Yang
  // dihitung cuma berkas yang memang direncanakan — playlist dan takarir dari
  // percobaan sebelumnya tidak boleh ikut jadi "berkas terakhir" dan membuat
  // segmen yang benar-benar separuh jadi lolos.
  const planned = new Set(plan.resources.map((resource) => resource.name))
  const existing = new Set((await listDir(dir)).filter((name) => planned.has(name)))
  const last = [...existing].sort().pop()
  if (last !== undefined) existing.delete(last)

  for (const [index, resource] of plan.resources.entries()) {
    checkStop(jobId)

    if (!existing.has(resource.name)) {
      await downloadFile(
        `${dir}/${resource.name}`,
        resource.url,
        mediaUrl(resource.url, video.headers),
        video.headers,
      )
    }

    await repos().downloads.setProgress(jobId, ((index + 1) / plan.resources.length) * 100)
    changed()
  }

  checkStop(jobId)
  await writeText(`${dir}/${PLAYLIST_NAME}`, plan.playlist)
}

/**
 * Isi playlist sebagai teks.
 *
 * Lewat `HttpClient`, bukan `fetch` ke alamat media: playlist bukan berkas yang
 * dipasang ke elemen, isinya perlu dibaca dan ditulis ulang — dan `HttpClient`
 * yang tahu cara memasang `Referer` di APK maupun di web. Alamat yang isinya
 * sudah ada di tangan (`data:`, `blob:`) tidak lewat sana sama sekali.
 */
async function fetchPlaylist(
  url: string,
  headers?: Readonly<Record<string, string>>,
): Promise<string> {
  if (isLocalUrl(url)) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Playlist HLS gagal dibaca (HTTP ${response.status}).`)
    return response.text()
  }

  const response = await transport.http.get(url, headers)
  if (!response.ok) throw new Error(`Playlist HLS gagal diambil (HTTP ${response.status}).`)
  return response.body
}

/**
 * Keadaan ruang penyimpanan. Dibuka lewat sini, bukan lewat `storage.service`
 * langsung, supaya halaman Unduhan cukup bicara dengan satu layanan — dan supaya
 * peringatan di UI serta penolakan di antrean membaca angka yang sama.
 */
export async function storageState(): Promise<StorageStatus> {
  return storageStatus(await storageEstimate())
}

/**
 * Menolak berangkat waktu ruangnya tinggal sedikit.
 *
 * Satu episode bisa ratusan megabita, dan kegagalan menulis di tengah jalan
 * meninggalkan setengah episode yang tetap memakan ruang tanpa bisa diputar.
 * Peringatan di UI ada di halaman Unduhan; ini jaring terakhirnya.
 */
async function guardStorage(): Promise<void> {
  const status = await storageState()
  if (status.level === 'full') throw new Error(status.message ?? 'Ruang penyimpanan habis.')
}

function checkStop(jobId: string): void {
  if (stopping.has(jobId)) throw STOPPED
}

// ── Menghapus ────────────────────────────────────────────────────────────────

/** Menghapus berkas satu chapter beserta catatan antreannya. */
export async function removeDownload(entry: EntryRow, item: ItemRow): Promise<void> {
  await removeFiles(entry, item)
  await repos().downloads.remove(item.id)
  changed()
}

/** Menghapus seluruh chapter terunduh dari satu judul sekaligus. */
export async function removeEntryDownloads(entry: EntryRow): Promise<void> {
  const { items, downloads } = repos()
  const rows = await items.listDownloaded(entry.id)

  await removeDir(entryDir(entry))
  await items.setDownloaded(
    rows.map((row) => row.id),
    false,
  )
  await downloads.removeMany(rows.map((row) => row.id))
  changed()
}

async function removeFiles(entry: EntryRow, item: ItemRow): Promise<void> {
  await removeDir(itemDir(entry, item))
  await repos().items.setDownloaded([item.id], false)
}

/**
 * Membuang chapter yang baru saja selesai dibaca, kalau setelannya menyala.
 *
 * Dipanggil reader, bukan dijadwalkan di latar: satu-satunya saat yang aman
 * menghapus berkas adalah tepat setelah orangnya selesai memakainya. Kegagalan
 * di sini tidak dilempar — gagal menghapus tidak boleh merusak momen "chapter
 * selesai dibaca".
 */
export async function cleanupAfterRead(entry: EntryRow, item: ItemRow): Promise<void> {
  if (!prefs.deleteAfterRead) return
  try {
    await removeDownload(entry, item)
  } catch {
    // Ruang tidak jadi kembali; itu saja.
  }
}

// ── Jalur uji ────────────────────────────────────────────────────────────────

/**
 * Daftar halaman tiruan untuk `scripts/smoke.mjs`.
 *
 * Situs sumber manga tidak terjangkau dari mesin pengembangan ini, jadi jalur
 * "unduh → matikan jaringan → tetap terbaca" mustahil diuji dengan sumber
 * sungguhan. Dengan beberapa gambar `data:` kecil, sisa rantainya (antrean,
 * penulisan berkas, tanda terunduh, reader membaca dari lokal) diuji apa adanya
 * di browser sungguhan — termasuk penyimpanannya, karena `data:` tetap ditulis
 * ke OPFS lewat jalan yang sama seperti gambar dari CDN.
 *
 * Cuma dipasang saat dev; build produksi tidak membawa jalur ini sama sekali.
 */
let fixturePages: SPage[] | null = null

if (import.meta.env.DEV) {
  const bridge = {
    fixture(pages: SPage[] | null): void {
      fixturePages = pages
    },
  }
  ;(globalThis as unknown as { __downloads?: typeof bridge }).__downloads = bridge
}

// ── Helper ───────────────────────────────────────────────────────────────────

async function contextOf(itemId: string): Promise<{ entry: EntryRow; item: ItemRow } | undefined> {
  const { items, entries } = repos()
  const item = await items.findById(itemId)
  if (!item) return undefined

  const entry = await entries.findById(item.entry_id)
  return entry ? { entry, item } : undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max)
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
