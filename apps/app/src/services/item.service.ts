import type { EntryRow, ItemRow } from '@mirai/db'
import { repos } from './db.service'

/**
 * Konteks satu item yang sedang dibuka — chapter maupun episode.
 *
 * Dipakai bersama reader dan player karena keduanya butuh hal yang sama persis:
 * entrinya, itemnya, tetangga sebelum/sesudah untuk tombol lompat, dan nomor
 * urutnya. Kalau digandakan, "berikutnya" bisa berarti dua hal berbeda di dua
 * layar yang sama-sama menampilkan daftar yang sama.
 */
export interface ItemContext {
  entry: EntryRow
  item: ItemRow
  /** Menurut urutan baca/tonton (nomor menaik), bukan urutan tampil. */
  previous: ItemRow | undefined
  next: ItemRow | undefined
  /** Nomor urut item ini di antara seluruh item entri, untuk "3 dari 120". */
  position: number
  total: number
}

/**
 * Konteks dari database saja — tanpa jaringan. Reader dan player memakainya
 * untuk langsung menampilkan judul, nomor, dan tombol berikutnya sebelum satu
 * pun gambar atau byte video sampai.
 */
export async function loadItemContext(itemId: string): Promise<ItemContext | undefined> {
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

/** Baris item terbaru dari database — dipakai setelah progres ditulis. */
export function reloadItem(id: string): Promise<ItemRow | undefined> {
  return repos().items.findById(id)
}
