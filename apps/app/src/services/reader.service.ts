import type { RemoteMangaSource } from '@mirai/extension-runtime'
import type { EntryRow, ItemRow } from '@mirai/db'
import { toSItem } from '@mirai/db'
import { repos } from './db.service'
import { transport } from './extensions.service'

/**
 * Reader manga: halaman satu chapter, progres bacanya, dan tetangganya.
 *
 * Batas yang berlaku sampai unduhan hadir di Fase 6: **daftar halaman selalu
 * datang dari jaringan.** Yang offline-first di sini cuma posisi baca dan
 * statusnya — itu ada di SQLite dan tidak pernah hilang.
 */

export interface ReaderPage {
  index: number
  /** URL siap pasang ke `<img>`; di web sudah lewat proxy, di native apa adanya. */
  url: string
}

/** Chapter yang sedang dibaca beserta konteks yang dibutuhkan reader. */
export interface ReaderContext {
  entry: EntryRow
  item: ItemRow
  /** Chapter sebelumnya/berikutnya menurut urutan baca (nomor menaik). */
  previous: ItemRow | undefined
  next: ItemRow | undefined
  /** Nomor urut item ini di antara seluruh chapter, untuk "3 dari 120". */
  position: number
  total: number
}

// ── Setelan ──────────────────────────────────────────────────────────────────

/**
 * Mode baca. `webtoon` menggulung menerus tanpa jeda halaman — bentuk yang
 * dipakai komik Korea/Indonesia yang satu chapternya satu gambar panjang;
 * `ltr`/`rtl` memisah per halaman seperti manga cetak.
 */
export type ReadingMode = 'ltr' | 'rtl' | 'webtoon'

/** Cara gambar mengisi layar. `width` yang paling masuk akal di HP tegak. */
export type PageFit = 'width' | 'height' | 'contain'

export interface ReaderPrefs {
  mode: ReadingMode
  fit: PageFit
  /** Berapa halaman berikutnya yang diambil di latar belakang. */
  preload: number
  /** Ketuk sisi kiri/kanan untuk berpindah halaman. */
  tapZones: boolean
  /** Sembunyikan nav sistem lewat Fullscreen API saat reader dibuka. */
  fullscreen: boolean
  /** Kunci orientasi layar; hanya berlaku di APK. */
  orientation: 'free' | 'portrait' | 'landscape'
}

export const defaultReaderPrefs: ReaderPrefs = {
  mode: 'webtoon',
  fit: 'width',
  preload: 3,
  tapZones: true,
  fullscreen: false,
  orientation: 'free',
}

const PREFS_KEY = 'reader.prefs'

export async function readReaderPrefs(): Promise<ReaderPrefs> {
  const stored = await repos().settings.getJson<Partial<ReaderPrefs>>(PREFS_KEY, {})
  return { ...defaultReaderPrefs, ...stored }
}

export async function writeReaderPrefs(prefs: ReaderPrefs): Promise<void> {
  await repos().settings.setJson(PREFS_KEY, prefs)
}

// ── Memuat ───────────────────────────────────────────────────────────────────

/**
 * Konteks chapter dari database saja — tanpa jaringan. Reader memakainya untuk
 * langsung menampilkan judul, nomor, dan tombol chapter berikutnya sebelum satu
 * pun gambar selesai diambil.
 */
export async function loadContext(itemId: string): Promise<ReaderContext | undefined> {
  const { items, entries } = repos()
  const item = await items.findById(itemId)
  if (!item) return undefined

  const entry = await entries.findById(item.entry_id)
  if (!entry) return undefined

  // Urutan baca, bukan urutan tampil: daftar di halaman detail menurun (terbaru
  // dulu), sedangkan "berikutnya" bagi pembaca selalu berarti nomor lebih besar.
  const ordered = await items.listByEntry(entry.id, false)
  const at = ordered.findIndex((row) => row.id === item.id)

  return {
    entry,
    item,
    previous: at > 0 ? ordered[at - 1] : undefined,
    next: at >= 0 ? ordered[at + 1] : undefined,
    position: at + 1,
    total: ordered.length,
  }
}

/**
 * Daftar halaman dari source.
 *
 * `headers` dari `SPage` ikut dititipkan ke resolver media: CDN gambar sering
 * menolak permintaan tanpa `Referer` yang benar, dan `<img>` tidak bisa
 * mengirim header sendiri — di web proxy yang memasangnya, di native
 * `CapacitorHttp` sudah bebas melakukannya.
 */
export async function loadPages(source: RemoteMangaSource, item: ItemRow): Promise<ReaderPage[]> {
  const pages = await source.getPageList(toSItem(item))

  return pages
    .filter((page) => typeof page.imageUrl === 'string' && page.imageUrl !== '')
    .map((page, index) => ({
      index,
      url: transport.media.toDisplayUrl(page.imageUrl, page.headers),
    }))
}

// ── Progres ──────────────────────────────────────────────────────────────────

/**
 * Menyimpan posisi baca. Dipanggil setiap kali halaman berganti, jadi menutup
 * app di tengah chapter tetap meninggalkan jejak — tidak ada tombol "simpan".
 */
export async function saveProgress(item: ItemRow, page: number, total: number): Promise<void> {
  await repos().items.setProgress(item.id, page, total)
  await repos().history.record(item.id, item.entry_id, page)
}

/**
 * Menandai chapter selesai.
 *
 * Ambangnya "halaman terakhir terlihat", bukan "halaman terakhir digulir
 * sampai bawah": di mode webtoon gambar terakhir bisa setinggi tiga layar, dan
 * memaksa penggunanya menggulir sampai piksel terakhir membuat chapter yang
 * jelas-jelas sudah dibaca tetap bertanda belum.
 */
export async function markFinished(item: ItemRow, total: number): Promise<void> {
  const { items, history } = repos()
  await items.markSeen([item.id], true)
  await items.setProgress(item.id, total, total)
  await history.record(item.id, item.entry_id, total)
}

/** Baris item terbaru dari database — dipakai setelah progres ditulis. */
export function reloadItem(id: string): Promise<ItemRow | undefined> {
  return repos().items.findById(id)
}
