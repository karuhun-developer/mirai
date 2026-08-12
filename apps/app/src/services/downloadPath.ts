import type { EntryRow, ItemRow } from '@mirai/db'

/**
 * Nama direktori dan berkas hasil unduhan.
 *
 * Dipisah dari lapisan penyimpanannya karena aturannya murni dan gampang salah:
 * id entri dan item berisi URL sumber lengkap (`komikcast::https://…/chapter-1/`),
 * sementara OPFS maupun Filesystem Android tidak menerima `/`, `:`, dan `?` di
 * nama berkas. Yang dipakai di sini "nama yang bisa dibaca manusia + sidik jari
 * id aslinya", supaya dua chapter berbeda tidak pernah jatuh ke direktori yang
 * sama walau namanya kebetulan sama persis.
 */

/** Akar semua unduhan. Satu tempat supaya menghapus semuanya cukup satu perintah. */
export const DOWNLOAD_ROOT = 'downloads'

/**
 * FNV-1a 32-bit.
 *
 * Bukan kriptografi — yang dibutuhkan cuma pembeda pendek yang stabil antar
 * sesi dan antar perangkat. `crypto.subtle` menghasilkan Promise dan memaksa
 * seluruh pembentukan path jadi asinkron demi tujuan yang tidak menuntut itu.
 */
export function fingerprint(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    // Perkalian FNV ditulis sebagai penjumlahan geseran supaya tetap di 32 bit;
    // `Math.imul` juga bisa, tapi bentuk ini yang lazim ditemui di implementasi
    // lain dan lebih gampang dicocokkan.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Satu ruas nama yang aman di semua sistem berkas yang dipakai Mirai.
 *
 * Selain karakter terlarang, panjangnya juga dipangkas: Android membatasi nama
 * berkas di 255 byte, dan judul manga panjang ditambah nama chapter gampang
 * melewatinya.
 */
export function safeSegment(value: string, max = 48): string {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .toLowerCase()
  return cleaned === '' ? 'x' : cleaned
}

/** `downloads/komikcast/one-piece-1a2b3c4d` — satu judul, satu direktori. */
export function entryDir(entry: EntryRow): string {
  return `${DOWNLOAD_ROOT}/${safeSegment(entry.source_id, 24)}/${safeSegment(entry.title)}-${fingerprint(entry.id)}`
}

/**
 * `…/one-piece-1a2b3c4d/0001-chapter-1-9f8e7d6c`.
 *
 * Nomor chapter ditaruh di depan dengan padding supaya isi direktori terurut
 * benar waktu dilihat lewat pengelola berkas — `10` sesudah `9`, bukan sesudah
 * `1`. Item tanpa nomor jatuh ke `0000`, dan sidik jari id-nya yang membedakan.
 */
export function itemDir(entry: EntryRow, item: ItemRow): string {
  const number = Math.max(0, Math.floor(item.number ?? 0))
  const prefix = String(number).padStart(4, '0')
  return `${entryDir(entry)}/${prefix}-${safeSegment(item.name)}-${fingerprint(item.id)}`
}

/**
 * Nama berkas satu halaman: `001.jpg`.
 *
 * Ekstensi diambil dari URL-nya, bukan dari `Content-Type`, karena nama berkas
 * sudah harus final sebelum satu byte pun turun — di native, plugin Filesystem
 * yang mengunduh langsung ke berkas tujuan. URL tanpa ekstensi yang dikenal
 * dianggap `.jpg`: itu yang benar untuk hampir semua CDN manga, dan salah
 * tebakan ekstensi tidak mengubah apa pun karena yang membaca berkasnya nanti
 * adalah `<img>` yang mengenali isinya sendiri.
 */
export function pageFileName(index: number, url: string): string {
  const match = /\.(jpe?g|png|webp|gif|avif|bmp)(?:$|[?#])/i.exec(url)
  const extension = match?.[1]?.toLowerCase() ?? 'jpg'
  return `${String(index + 1).padStart(3, '0')}.${extension === 'jpeg' ? 'jpg' : extension}`
}
