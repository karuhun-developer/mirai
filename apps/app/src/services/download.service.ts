import type { RemoteMangaSource, RemoteSource } from '@mirai/extension-runtime'
import type { DownloadEntry, DownloadRow, EntryRow, ItemRow } from '@mirai/db'
import { toSItem } from '@mirai/db'
import { repos } from './db.service'
import { transport } from './extensions.service'
import { entryDir, itemDir, pageFileName } from './downloadPath'
import { downloadFile, fileUrl, listDir, removeDir, requestPersistence } from './storage.service'

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
 * Membatalkan satu pekerjaan sekaligus membuang berkas separuh jadinya.
 *
 * Yang sudah `done` tidak lewat sini — itu urusan `removeDownload()`, yang
 * namanya jujur soal "menghapus chapter yang sudah tersimpan".
 */
export async function cancel(job: DownloadRow): Promise<void> {
  stopping.add(job.id)
  await repos().downloads.remove(job.id)
  const context = await contextOf(job.item_id)
  if (context) await removeFiles(context.entry, context.item)
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
        'Extension sumber chapter ini tidak terpasang atau sedang dimatikan, jadi halamannya tidak bisa diambil.',
      )
    }
    if (source.kind !== 'manga') throw new Error('Sumber ini bukan sumber manga.')

    const path = await downloadChapter(source as RemoteMangaSource, entry, item, job.id)

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
  const pages = (await source.getPageList(toSItem(item))).filter(
    (page) => typeof page.imageUrl === 'string' && page.imageUrl !== '',
  )
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
        transport.media.toDisplayUrl(page.imageUrl, page.headers),
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

function checkStop(jobId: string): void {
  if (stopping.has(jobId)) throw STOPPED
}

// ── Membaca dari lokal ───────────────────────────────────────────────────────

export interface LocalPage {
  index: number
  url: string
}

/**
 * Halaman satu chapter dari berkas di perangkat.
 *
 * Urutannya dari nama berkas, bukan dari daftar halaman source: itulah inti
 * offline — waktu jaringannya mati, `getPageList()` tidak bisa dipanggil sama
 * sekali. Nama `001.jpg` yang berpadding itulah yang membuat urutannya benar.
 *
 * Alamat hasilnya di web berupa `blob:` yang menahan isi berkas di memori;
 * pemanggilnya wajib memanggil `releaseLocalPages()` waktu selesai.
 */
export async function localPages(entry: EntryRow, item: ItemRow): Promise<LocalPage[]> {
  const dir = itemDir(entry, item)
  const names = await listDir(dir)

  const pages: LocalPage[] = []
  for (const [index, name] of names.entries()) {
    const url = await fileUrl(`${dir}/${name}`)
    if (url) pages.push({ index, url })
  }
  return pages
}

export function releaseLocalPages(pages: readonly LocalPage[]): void {
  for (const page of pages) {
    if (page.url.startsWith('blob:')) URL.revokeObjectURL(page.url)
  }
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
