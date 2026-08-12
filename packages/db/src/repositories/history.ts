import { persist } from '../db.js'
import type { Db, EntryKind, HistoryRow } from '../types.js'
import { nowMs } from '../util.js'

/** Satu baris riwayat beserta apa yang perlu ditampilkan di daftarnya. */
export interface HistoryEntry extends HistoryRow {
  item_name: string
  item_number: number | null
  entry_title: string
  entry_kind: EntryKind
  entry_thumbnail: string | null
  entry_url: string
  source_id: string
}

/**
 * Riwayat baca/tonton. Kuncinya `item_id`, bukan `id` bikinan sendiri — yang
 * ingin diketahui selalu "kapan terakhir item ini dibuka", bukan "berapa kali".
 * Karena itu repository ini tidak memakai `BaseRepository`, yang menganggap
 * setiap tabel punya kolom `id`.
 */
export class HistoryRepository {
  constructor(private readonly db: Db) {}

  private async persisted(): Promise<void> {
    if (!this.db.inTransaction) await persist()
  }

  /** Dipanggil setiap kali reader/player membuka atau menutup sebuah item. */
  async record(itemId: string, entryId: string, position: number): Promise<void> {
    await this.db.run(
      `INSERT INTO history (item_id, entry_id, read_at, position) VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET read_at = excluded.read_at, position = excluded.position`,
      [itemId, entryId, nowMs(), position],
    )
    await this.persisted()
  }

  recent(limit = 100): Promise<HistoryEntry[]> {
    return this.db.query<HistoryEntry>(
      `SELECT h.*, i.name AS item_name, i.number AS item_number,
              e.title AS entry_title, e.kind AS entry_kind,
              e.thumbnail_url AS entry_thumbnail, e.url AS entry_url, e.source_id AS source_id
         FROM history h
         JOIN item i ON i.id = h.item_id
         JOIN entry e ON e.id = h.entry_id
        ORDER BY h.read_at DESC
        LIMIT ?`,
      [limit],
    )
  }

  async lastOf(entryId: string): Promise<HistoryRow | undefined> {
    const rows = await this.db.query<HistoryRow>(
      'SELECT * FROM history WHERE entry_id = ? ORDER BY read_at DESC LIMIT 1',
      [entryId],
    )
    return rows[0]
  }

  async remove(itemId: string): Promise<void> {
    await this.db.run('DELETE FROM history WHERE item_id = ?', [itemId])
    await this.persisted()
  }

  async clear(): Promise<void> {
    await this.db.run('DELETE FROM history')
    await this.persisted()
  }
}
