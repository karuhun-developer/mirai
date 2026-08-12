import type { SAnime, SEntry, SManga } from '@mirai/extension-api'
import type { RemoteSource } from '@mirai/extension-runtime'
import type { CategoryRow, EntryKind, EntryRow, ItemRow, SyncResult } from '@mirai/db'
import { entryId, toSEntry } from '@mirai/db'
import { repos } from './db.service'

/**
 * Satu entri: baris library-nya, daftar chapter/episode-nya, dan cara
 * menyegarkan keduanya dari source.
 *
 * Aturan yang dipegang seluruh berkas ini: **yang tersimpan selalu ditampilkan
 * lebih dulu, jaringan menyusul.** Membuka judul yang pernah dibuka harus
 * langsung memperlihatkan isinya walau sedang offline; kegagalan refresh cuma
 * jadi pesan di atas daftar, bukan halaman kosong.
 */

export interface EntryBundle {
  entry: EntryRow
  items: ItemRow[]
  categories: CategoryRow[]
}

export function idOf(sourceId: string, url: string): string {
  return entryId(sourceId, url)
}

export async function loadEntry(id: string): Promise<EntryBundle | undefined> {
  const { entries, items, categories } = repos()
  const entry = await entries.findById(id)
  if (!entry) return undefined

  return {
    entry,
    items: await items.listByEntry(entry.id),
    categories: await categories.forEntry(entry.id),
  }
}

/**
 * Menyimpan hasil katalog. Dipanggil halaman Browse setiap kali daftar dimuat,
 * supaya membuka detailnya — bahkan setelah jaringan mati — selalu menemukan
 * baris yang sudah ada, lengkap dengan judul dan cover.
 */
export function rememberCatalogue(
  kind: EntryKind,
  sourceId: string,
  list: SEntry[],
): Promise<EntryRow[]> {
  return repos().entries.saveCatalogue(kind, sourceId, list)
}

/**
 * Id mana saja dari daftar ini yang ada di library. Dipakai grid Browse untuk
 * menandai judul yang sudah difavoritkan — `saveCatalogue()` tidak bisa
 * menjawabnya karena yang dikembalikannya baris yang ditulis, bukan yang
 * tersimpan.
 */
export async function favoriteIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const placeholders = ids.map(() => '?').join(', ')
  const rows = await repos().entries.list({
    where: `favorite = 1 AND id IN (${placeholders})`,
    params: ids,
  })
  return new Set(rows.map((row) => row.id))
}

/** Entri yang belum pernah diambil detail atau daftar itemnya. */
export function isStale(entry: EntryRow): boolean {
  return entry.details_at === null || entry.items_at === null
}

/**
 * Mengambil detail dan daftar item dari source, lalu menyatukannya dengan yang
 * tersimpan. Progres baca dan status unduhan tidak tersentuh — itu urusan
 * `upsert()` berkolom-terbatas di repository.
 */
export async function refreshEntry(source: RemoteSource, entry: EntryRow): Promise<SyncResult> {
  const { entries, items } = repos()
  const stub = toSEntry(entry)

  const details = await source.getDetails(stub)
  await entries.saveDetails(entry.kind, entry.source_id, details)

  const list =
    source.kind === 'manga'
      ? await source.getChapterList(details as SManga)
      : await source.getEpisodeList(details as SAnime)

  // Baris dibaca ulang: `saveDetails()` baru saja mengubahnya, dan
  // `syncFromSource()` memutuskan "ini sinkronisasi pertama atau bukan" dari
  // isi baris yang diterimanya.
  const fresh = (await entries.findById(entry.id)) ?? entry
  return items.syncFromSource(fresh, list)
}

/**
 * Menandai favorit. Yang baru masuk library langsung disinkronkan kalau daftar
 * itemnya belum pernah diambil — badge "belum dibaca" yang selalu nol karena
 * itemnya tidak pernah diambil lebih membingungkan daripada tidak ada badge.
 */
export async function setFavorite(
  entry: EntryRow,
  favorite: boolean,
  source?: RemoteSource,
): Promise<EntryRow | undefined> {
  const updated = await repos().entries.setFavorite(entry.id, favorite)
  if (favorite && source && updated && updated.items_at === null) {
    await refreshEntry(source, updated).catch(() => undefined)
    return repos().entries.findById(entry.id)
  }
  return updated
}

/**
 * Menandai item sudah/belum dibaca.
 *
 * Menandai sudah dibaca juga mencatat riwayat: sampai reader hadir (Fase 4),
 * inilah satu-satunya peristiwa "saya membaca ini", dan halaman Riwayat yang
 * selalu kosong tidak bisa dibuktikan bertahan offline. Nanti reader mencatat
 * hal yang sama dengan posisi yang sebenarnya.
 */
export async function setSeen(item: ItemRow, seen: boolean): Promise<void> {
  const { items, history } = repos()
  await items.markSeen([item.id], seen)
  if (seen) await history.record(item.id, item.entry_id, item.last_position)
  else await history.remove(item.id)
}

/**
 * Menandai satu item beserta semua yang lebih lama sebagai sudah dibaca —
 * kebiasaan yang lazim setelah membaca beberapa chapter di tempat lain.
 * Riwayat tidak ikut ditulis untuk yang lain: yang benar-benar dibuka cuma satu.
 */
export async function setSeenUpTo(all: ItemRow[], target: ItemRow): Promise<void> {
  const older = all.filter((item) => rank(item) <= rank(target)).map((item) => item.id)
  await repos().items.markSeen(older, true)
  await repos().history.record(target.id, target.entry_id, target.last_position)
}

/** Urutan pembacaan: nomor kalau ada, kalau tidak urutan asli dari source. */
function rank(item: ItemRow): number {
  return item.number ?? item.sort_index
}

export async function setEntrySeen(entry: EntryRow, seen: boolean): Promise<void> {
  await repos().items.markEntrySeen(entry.id, seen)
}

export async function setBookmark(item: ItemRow, bookmark: boolean): Promise<void> {
  await repos().items.setBookmark(item.id, bookmark)
}

export function nextUnseen(entryId_: string): Promise<ItemRow | undefined> {
  return repos().items.nextUnseen(entryId_)
}

/** Menghapus entri dari database sekaligus item dan riwayatnya (cascade). */
export async function forgetEntry(entry: EntryRow): Promise<void> {
  await repos().entries.remove(entry.id)
}
