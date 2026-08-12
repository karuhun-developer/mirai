import type { CategoryRow, EntryKind } from '../types.js'
import { nowMs, randomId } from '../util.js'
import { BaseRepository } from './base.js'

/**
 * Kategori adalah tab di halaman Library. Dipisah per jenis: seseorang yang
 * memakai "Sedang tayang" untuk anime tidak otomatis menginginkan tab yang
 * sama muncul di manga.
 */
export class CategoryRepository extends BaseRepository<CategoryRow> {
  protected readonly table = 'category'

  listByKind(kind: EntryKind): Promise<CategoryRow[]> {
    return this.list({
      where: 'kind = ?',
      params: [kind],
      orderBy: 'sort_order ASC, name COLLATE NOCASE ASC',
    })
  }

  async create(name: string, kind: EntryKind): Promise<CategoryRow> {
    const last = await this.db.query<{ next: number | null }>(
      'SELECT MAX(sort_order) + 1 AS next FROM category WHERE kind = ?',
      [kind],
    )
    return this.insert({
      id: randomId(),
      name: name.trim(),
      kind,
      sort_order: last[0]?.next ?? 0,
      updated_at: nowMs(),
    })
  }

  rename(id: string, name: string): Promise<CategoryRow | undefined> {
    return this.update(id, { name: name.trim() })
  }

  /** Urutan disimpan dari susunan daftar, bukan dari indeks yang dikirim UI. */
  async reorder(ids: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx.run('UPDATE category SET sort_order = ?, updated_at = ? WHERE id = ?', [
          index,
          nowMs(),
          id,
        ])
      }
    })
    await this.persisted(undefined)
  }

  forEntry(entryId: string): Promise<CategoryRow[]> {
    return this.db.query<CategoryRow>(
      `SELECT c.* FROM category c
         JOIN entry_category ec ON ec.category_id = c.id
        WHERE ec.entry_id = ?
        ORDER BY c.sort_order ASC`,
      [entryId],
    )
  }

  /**
   * Mengganti seluruh keanggotaan satu entri sekaligus. Dijalankan sebagai
   * hapus-lalu-tulis di dalam satu transaksi: dialog kategori mengirim keadaan
   * akhir yang diinginkan, bukan selisihnya.
   */
  async setForEntry(entryId: string, categoryIds: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run('DELETE FROM entry_category WHERE entry_id = ?', [entryId])
      for (const categoryId of categoryIds) {
        await tx.run(
          'INSERT OR IGNORE INTO entry_category (entry_id, category_id, added_at) VALUES (?, ?, ?)',
          [entryId, categoryId, nowMs()],
        )
      }
    })
    await this.persisted(undefined)
  }

  /** Jumlah entri favorit per kategori, untuk angka kecil di tab. */
  async counts(kind: EntryKind): Promise<Record<string, number>> {
    const rows = await this.db.query<{ category_id: string; total: number }>(
      `SELECT ec.category_id AS category_id, COUNT(*) AS total
         FROM entry_category ec
         JOIN entry e ON e.id = ec.entry_id
        WHERE e.kind = ? AND e.favorite = 1
        GROUP BY ec.category_id`,
      [kind],
    )
    return Object.fromEntries(rows.map((row) => [row.category_id, row.total]))
  }
}
