import type { ItemRow } from '@mirai/db'

/**
 * Pencocokan chapter/episode lintas source untuk migrasi.
 *
 * Dipisah dari `migrate.service` karena inilah bagian yang bisa salah dengan
 * cara yang sunyi — progres pindah ke chapter yang keliru dan tidak ada yang
 * memberi tahu — jadi aturannya harus bisa diuji tanpa database, tanpa
 * extension, dan tanpa jaringan.
 */

/** Pasangan item lama → item baru yang dianggap chapter/episode yang sama. */
export interface Pairing {
  old: ItemRow
  next: ItemRow
}

/**
 * Mencocokkan berdasarkan **nomor**, bukan judul.
 *
 * Judul chapter berbeda di tiap situs ("Chapter 12", "Ch. 12 - Pulang", "12"),
 * sementara nomornya adalah satu-satunya yang disepakati semua sumber. Item
 * tanpa nomor tidak dicocokkan sama sekali: menebaknya lewat urutan akan meleset
 * satu langkah begitu salah satu source melewatkan sebuah chapter.
 */
export function pairByNumber(
  oldItems: readonly ItemRow[],
  newItems: readonly ItemRow[],
): Pairing[] {
  const byNumber = new Map<number, ItemRow>()
  for (const item of newItems) {
    if (item.number === null) continue
    // Yang pertama menang: kalau source baru punya dua "chapter 12" (rilis
    // ganda dari scanlator berbeda), yang teratas di daftarnya yang dipakai.
    if (!byNumber.has(item.number)) byNumber.set(item.number, item)
  }

  const pairs: Pairing[] = []
  for (const item of oldItems) {
    if (item.number === null) continue
    // Cuma yang pernah disentuh yang perlu dipindah; sisanya sudah bersih.
    if (item.seen === 0 && item.last_position === 0 && item.bookmark === 0) continue
    const next = byNumber.get(item.number)
    if (next) pairs.push({ old: item, next })
  }
  return pairs
}
