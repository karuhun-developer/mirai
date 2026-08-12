import type { RemoteMangaSource } from '@mirai/extension-runtime'
import type { EntryRow, ItemRow } from '@mirai/db'
import { toSItem } from '@mirai/db'
import { repos } from './db.service'
import { transport } from './extensions.service'
import { cleanupAfterRead, localPages, releaseLocalPages } from './download.service'

/**
 * Reader manga: halaman satu chapter, progres bacanya, dan tetangganya.
 *
 * Chapter yang sudah diunduh dibaca dari berkas di perangkat; sisanya dari
 * jaringan. Yang selalu lokal adalah posisi baca dan statusnya — itu di SQLite
 * dan tidak pernah hilang.
 */

export interface ReaderPage {
  index: number
  /** URL siap pasang ke `<img>`; di web sudah lewat proxy, di native apa adanya. */
  url: string
}

export interface ReaderPages {
  pages: ReaderPage[]
  /**
   * Halamannya dari berkas lokal. Penting bagi pemanggil: di web alamatnya
   * `blob:` yang menahan seluruh isi berkas di memori sampai dicabut.
   */
  local: boolean
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
 * Halaman satu chapter: dari perangkat kalau sudah diunduh, dari source kalau
 * belum.
 *
 * Lokal selalu didahulukan, bahkan waktu jaringannya sehat — itulah gunanya
 * mengunduh. Chapter yang bertanda terunduh tapi berkasnya tidak ditemukan
 * (browser membuang OPFS waktu ruang menipis, atau berkasnya dihapus dari luar)
 * tandanya diturunkan di tempat, lalu diambil ulang dari jaringan seperti biasa
 * — lebih baik daripada reader kosong yang bersikeras chapternya ada.
 */
export async function loadPages(
  entry: EntryRow,
  item: ItemRow,
  source: RemoteMangaSource | undefined,
): Promise<ReaderPages> {
  if (item.downloaded === 1) {
    const pages = await localPages(entry, item)
    if (pages.length > 0) return { pages, local: true }
    await repos().items.setDownloaded([item.id], false)
  }

  if (!source) {
    throw new Error(
      'Chapter ini belum diunduh, jadi halamannya harus diambil dari internet — dan extension sumbernya tidak terpasang atau sedang dimatikan.',
    )
  }

  return { pages: await fetchPages(source, item), local: false }
}

/**
 * `headers` dari `SPage` ikut dititipkan ke resolver media: CDN gambar sering
 * menolak permintaan tanpa `Referer` yang benar, dan `<img>` tidak bisa
 * mengirim header sendiri — di web proxy yang memasangnya, di native
 * `CapacitorHttp` sudah bebas melakukannya.
 */
async function fetchPages(source: RemoteMangaSource, item: ItemRow): Promise<ReaderPage[]> {
  let pages
  try {
    pages = await source.getPageList(toSItem(item))
  } catch (cause) {
    // Offline dengan chapter yang belum diunduh adalah kegagalan yang paling
    // sering terjadi di sini, dan pesan mentah dari lapisan HTTP ("Failed to
    // fetch") tidak memberi tahu apa yang bisa dilakukan orangnya.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Perangkat sedang offline dan chapter ini belum diunduh.', { cause })
    }
    throw cause
  }

  return pages
    .filter((page) => typeof page.imageUrl === 'string' && page.imageUrl !== '')
    .map((page, index) => ({
      index,
      url: transport.media.toDisplayUrl(page.imageUrl, page.headers),
    }))
}

/** Melepas alamat `blob:` halaman lokal; wajib dipanggil waktu reader ditutup. */
export function releasePages(pages: readonly ReaderPage[]): void {
  releaseLocalPages(pages)
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

/**
 * Auto-hapus setelah dibaca, dijalankan waktu reader **ditutup** — bukan waktu
 * halaman terakhir tercapai.
 *
 * Bedanya nyata di native: alamat berkas lokal di sana menunjuk berkas
 * sungguhan, jadi menghapusnya selagi gambarnya masih terpasang di layar
 * membuat halaman terakhir mendadak kosong tepat di detik terakhir membaca.
 */
export async function cleanupIfFinished(entry: EntryRow, item: ItemRow): Promise<void> {
  if (item.seen !== 1 || item.downloaded !== 1) return
  await cleanupAfterRead(entry, item)
}
