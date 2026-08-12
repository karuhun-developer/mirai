import type { SEntry } from '@mirai/extension-api'
import type { EntryKind, EntryRow, LibraryEntry } from '@mirai/db'

/**
 * Bentuk tunggal yang dipahami grid.
 *
 * Library membaca `LibraryEntry` dari SQLite dan Browse menerima `SEntry` dari
 * extension; keduanya diratakan di sini supaya `EntryCard` tidak perlu tahu
 * asal datanya, dan supaya kartu di dua halaman itu tidak pelan-pelan jadi
 * berbeda.
 */
export interface GridEntry {
  kind: EntryKind
  sourceId: string
  url: string
  title: string
  thumbnailUrl: string | null
  /** Jumlah item belum dibaca; badge disembunyikan kalau nol/undefined. */
  unread?: number
  downloaded?: boolean
  favorite?: boolean
}

export function fromSource(kind: EntryKind, sourceId: string, entry: SEntry): GridEntry {
  return {
    kind,
    sourceId,
    url: entry.url,
    title: entry.title,
    thumbnailUrl: entry.thumbnailUrl ?? null,
  }
}

export function fromLibrary(row: LibraryEntry): GridEntry {
  return {
    kind: row.kind,
    sourceId: row.source_id,
    url: row.url,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    unread: row.unread,
    downloaded: row.downloaded_count > 0,
    favorite: row.favorite === 1,
  }
}

export function fromRow(row: EntryRow): GridEntry {
  return {
    kind: row.kind,
    sourceId: row.source_id,
    url: row.url,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    favorite: row.favorite === 1,
  }
}
