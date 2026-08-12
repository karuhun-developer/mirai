import type { CategoryRow, EntryKind, LibraryEntry, LibraryQuery, LibrarySort } from '@mirai/db'
import { repos } from './db.service'

/**
 * Library: entri yang difavoritkan, kategorinya, dan setelan tampilannya.
 *
 * Lapisan ini yang menerjemahkan maunya UI ke `LibraryQuery`; store dan
 * komponen tidak pernah menyusun SQL sendiri.
 */

export interface LibraryPrefs {
  sort: LibrarySort
  descending: boolean
  unreadOnly: boolean
  downloadedOnly: boolean
}

export const defaultPrefs: LibraryPrefs = {
  sort: 'title',
  descending: false,
  unreadOnly: false,
  downloadedOnly: false,
}

const PREFS_KEY = 'library.prefs'

/**
 * Kategori yang sedang dibuka disimpan sebagai teks, dengan dua nilai khusus:
 * `all` (semua) dan `none` (belum dikategorikan). Keduanya aman karena id
 * kategori selalu 32 karakter heksadesimal dari `randomId()`.
 */
export const ALL_CATEGORIES = 'all'
export const NO_CATEGORY = 'none'

function categoryKey(kind: EntryKind): string {
  return `library.category.${kind}`
}

export async function readPrefs(): Promise<LibraryPrefs> {
  const stored = await repos().settings.getJson<Partial<LibraryPrefs>>(PREFS_KEY, {})
  return { ...defaultPrefs, ...stored }
}

export async function writePrefs(prefs: LibraryPrefs): Promise<void> {
  await repos().settings.setJson(PREFS_KEY, prefs)
}

export async function readActiveCategory(kind: EntryKind): Promise<string> {
  return (await repos().settings.get(categoryKey(kind))) ?? ALL_CATEGORIES
}

export async function writeActiveCategory(kind: EntryKind, value: string): Promise<void> {
  await repos().settings.set(categoryKey(kind), value)
}

/** Nilai `categoryId` yang dipahami `LibraryQuery` dari pilihan tab. */
function toCategoryFilter(selection: string): string | null | undefined {
  if (selection === ALL_CATEGORIES) return undefined
  if (selection === NO_CATEGORY) return null
  return selection
}

export function listLibrary(
  kind: EntryKind,
  selection: string,
  search: string,
  prefs: LibraryPrefs,
): Promise<LibraryEntry[]> {
  const categoryId = toCategoryFilter(selection)
  const query: LibraryQuery = {
    kind,
    search,
    sort: prefs.sort,
    descending: prefs.descending,
    unreadOnly: prefs.unreadOnly,
    downloadedOnly: prefs.downloadedOnly,
    // `exactOptionalPropertyTypes` membedakan "tidak dikirim" dari
    // "dikirim undefined", dan di sini keduanya memang berbeda artinya.
    ...(categoryId === undefined ? {} : { categoryId }),
  }
  return repos().entries.library(query)
}

export function listCategories(kind: EntryKind): Promise<CategoryRow[]> {
  return repos().categories.listByKind(kind)
}

export function categoryCounts(kind: EntryKind): Promise<Record<string, number>> {
  return repos().categories.counts(kind)
}

export function createCategory(name: string, kind: EntryKind): Promise<CategoryRow> {
  return repos().categories.create(name, kind)
}

export function renameCategory(id: string, name: string): Promise<CategoryRow | undefined> {
  return repos().categories.rename(id, name)
}

/**
 * Menghapus kategori tidak menghapus entri di dalamnya — foreign key cuma
 * membuang baris keanggotaannya. Judulnya tetap di library, tanpa kategori.
 */
export async function removeCategory(id: string): Promise<void> {
  await repos().categories.remove(id)
}

export function reorderCategories(ids: string[]): Promise<void> {
  return repos().categories.reorder(ids)
}

export function categoriesOf(entryId: string): Promise<CategoryRow[]> {
  return repos().categories.forEntry(entryId)
}

export function setEntryCategories(entryId: string, categoryIds: string[]): Promise<void> {
  return repos().categories.setForEntry(entryId, categoryIds)
}

/** Jumlah entri favorit per jenis; dipakai badge nav dan halaman Lainnya. */
export function countFavorites(kind: EntryKind): Promise<number> {
  return repos().entries.count('kind = ? AND favorite = 1', [kind])
}
