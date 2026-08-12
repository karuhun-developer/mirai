import type { SAnime, SEntry, SManga } from '@mirai/extension-api'
import type { EntryKind, EntryRow } from '../types.js'
import { toEntryRow } from '../mapping.js'
import { entryId, nowMs, toFlag } from '../util.js'
import { BaseRepository } from './base.js'

/** Entri library beserta angka yang selalu ikut ditampilkan di grid. */
export interface LibraryEntry extends EntryRow {
  unread: number
  downloaded_count: number
  last_read_at: number | null
}

export type LibrarySort = 'title' | 'added' | 'last_read' | 'unread'

export interface LibraryQuery {
  kind: EntryKind
  /**
   * `undefined` = semua kategori, `null` = khusus entri yang belum
   * dikategorikan. Dua hal yang berbeda, dan tab "Tanpa kategori" memerlukan
   * yang kedua.
   */
  categoryId?: string | null
  search?: string
  sort?: LibrarySort
  descending?: boolean
  unreadOnly?: boolean
  downloadedOnly?: boolean
}

/**
 * Daftar putih pengurutan. `ORDER BY` tidak bisa di-parameterkan, jadi satu-
 * satunya cara aman adalah memetakan pilihan UI ke SQL yang ditulis di sini.
 */
const SORT_SQL: Record<LibrarySort, string> = {
  title: 'e.title COLLATE NOCASE',
  added: 'e.added_at',
  last_read: 'last_read_at',
  unread: 'unread',
}

/** Kolom yang boleh ditimpa hasil katalog — sisanya milik pengguna. */
const CATALOGUE_COLUMNS = ['title', 'thumbnail_url', 'updated_at'] as const

/** Kolom yang boleh ditimpa hasil `getDetails()`. */
const DETAIL_COLUMNS = [
  'title',
  'thumbnail_url',
  'author',
  'artist',
  'description',
  'genre',
  'status',
  'studio',
  'total_episodes',
  'details_at',
  'updated_at',
] as const

export class EntryRepository extends BaseRepository<EntryRow> {
  protected readonly table = 'entry'

  find(sourceId: string, url: string): Promise<EntryRow | undefined> {
    return this.findById(entryId(sourceId, url))
  }

  /**
   * Menyimpan hasil katalog. Dipanggil setiap kali halaman Browse memuat, jadi
   * kolom yang ditimpa dibatasi ketat: judul dan cover boleh disegarkan,
   * favorit dan deskripsi hasil `getDetails()` tidak boleh hilang gara-gara
   * seseorang membuka daftar Populer.
   */
  async saveCatalogue(kind: EntryKind, sourceId: string, entries: SEntry[]): Promise<EntryRow[]> {
    if (entries.length === 0) return []
    return this.db.transaction(async (tx) => {
      const repo = new EntryRepository(tx)
      const rows: EntryRow[] = []
      for (const entry of entries) {
        rows.push(await repo.upsert(toEntryRow(kind, sourceId, entry), CATALOGUE_COLUMNS))
      }
      return rows
    })
  }

  /** Menyimpan hasil `getDetails()`; menandai kapan detailnya diambil. */
  async saveDetails(
    kind: EntryKind,
    sourceId: string,
    details: SManga | SAnime,
  ): Promise<EntryRow> {
    const row = { ...toEntryRow(kind, sourceId, details), details_at: nowMs() }
    return this.upsert(row, DETAIL_COLUMNS)
  }

  /**
   * `added_at` diisi sekali saat pertama difavoritkan dan tidak pernah direset
   * saat dicabut — mengurutkan library "yang terbaru ditambahkan" jadi tidak
   * kacau kalau seseorang salah pencet lalu memfavoritkan lagi.
   */
  async setFavorite(id: string, favorite: boolean): Promise<EntryRow | undefined> {
    const existing = await this.findById(id)
    if (!existing) return undefined

    return this.update(id, {
      favorite: toFlag(favorite),
      added_at: favorite ? (existing.added_at ?? nowMs()) : existing.added_at,
    })
  }

  /** Menandai kapan daftar chapter/episode terakhir disegarkan. */
  async touchItems(id: string): Promise<void> {
    await this.update(id, { items_at: nowMs() })
  }

  async library(query: LibraryQuery): Promise<LibraryEntry[]> {
    const conditions = ['e.kind = ?', 'e.favorite = 1']
    const params: unknown[] = [query.kind]

    if (query.categoryId === null) {
      conditions.push('NOT EXISTS (SELECT 1 FROM entry_category ec WHERE ec.entry_id = e.id)')
    } else if (query.categoryId !== undefined) {
      conditions.push(
        'EXISTS (SELECT 1 FROM entry_category ec WHERE ec.entry_id = e.id AND ec.category_id = ?)',
      )
      params.push(query.categoryId)
    }

    const search = query.search?.trim()
    if (search) {
      conditions.push('e.title LIKE ? COLLATE NOCASE')
      params.push(`%${search}%`)
    }

    // Subquery-nya ditulis ulang di WHERE alih-alih memakai alias kolom hasil:
    // SQLite menerima alias di ORDER BY, tapi tidak di WHERE.
    if (query.unreadOnly) {
      conditions.push('(SELECT COUNT(*) FROM item i WHERE i.entry_id = e.id AND i.seen = 0) > 0')
    }
    if (query.downloadedOnly) {
      conditions.push(
        '(SELECT COUNT(*) FROM item i WHERE i.entry_id = e.id AND i.downloaded = 1) > 0',
      )
    }

    const sort = SORT_SQL[query.sort ?? 'title']
    const direction = query.descending ? 'DESC' : 'ASC'

    return this.db.query<LibraryEntry>(
      `SELECT e.*,
              (SELECT COUNT(*) FROM item i WHERE i.entry_id = e.id AND i.seen = 0) AS unread,
              (SELECT COUNT(*) FROM item i WHERE i.entry_id = e.id AND i.downloaded = 1)
                AS downloaded_count,
              (SELECT MAX(h.read_at) FROM history h WHERE h.entry_id = e.id) AS last_read_at
         FROM entry e
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${sort} ${direction}, e.title COLLATE NOCASE ASC`,
      params,
    )
  }

  /**
   * Entri yang tidak difavoritkan dan tidak punya progres apa pun. Katalog
   * yang cuma dilihat sekilas tidak boleh menumpuk selamanya di perangkat.
   */
  async pruneOrphans(): Promise<number> {
    const result = await this.db.run(
      `DELETE FROM entry
        WHERE favorite = 0
          AND NOT EXISTS (SELECT 1 FROM history h WHERE h.entry_id = entry.id)
          AND NOT EXISTS (SELECT 1 FROM item i WHERE i.entry_id = entry.id AND i.seen = 1)`,
    )
    return this.persisted(result.changes)
  }
}
