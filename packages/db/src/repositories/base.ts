import { persist } from '../db.js'
import type { Db, RunResult } from '../types.js'
import { nowMs } from '../util.js'

export interface ListOptions {
  where?: string
  params?: unknown[]
  orderBy?: string
  limit?: number
  offset?: number
}

/** Baris minimal yang bisa dilayani repository generik. */
export interface BaseRow {
  id: string
  updated_at: number
}

/**
 * CRUD generik di atas SQL mentah — tanpa ORM, sama seperti POS Kacaw.
 *
 * Bedanya: **tidak ada soft delete dan tidak ada outbox.** Mirai tidak
 * menyinkronkan apa pun ke server, jadi baris yang dihapus tidak perlu
 * disimpan sebagai nisan, dan `DELETE` yang sungguhan membuat cascade foreign
 * key ikut membereskan chapter dan riwayatnya.
 *
 * `updated_at` tetap dijaga karena backup/restore (Fase 9) memerlukannya untuk
 * memutuskan versi mana yang lebih baru.
 */
export abstract class BaseRepository<T extends BaseRow> {
  protected abstract readonly table: string

  constructor(protected readonly db: Db) {}

  /**
   * Menyimpan snapshot setelah write — kecuali kalau kita sedang di dalam
   * transaksi. Snapshot di tengah transaksi menyimpan keadaan setengah jadi,
   * dan transaksi terluarlah yang akan memanggilnya setelah commit.
   */
  protected async persisted<R>(result: R): Promise<R> {
    if (!this.db.inTransaction) await persist()
    return result
  }

  async insert(row: T): Promise<T> {
    const columns = Object.keys(row)
    const placeholders = columns.map(() => '?').join(', ')
    await this.db.run(
      `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})`,
      columns.map((column) => (row as Record<string, unknown>)[column]),
    )
    return this.persisted(row)
  }

  /**
   * Menyimpan baris yang mungkin sudah ada.
   *
   * `updateColumns` menentukan kolom mana yang boleh ditimpa data baru. Itu
   * bukan detail: entri yang disegarkan dari katalog membawa judul dan cover
   * terbaru, tapi TIDAK boleh menimpa `favorite` atau `added_at` milik
   * pengguna. Tanpa daftar ini, membuka Browse akan diam-diam mengosongkan
   * library.
   */
  async upsert(row: T, updateColumns?: readonly (keyof T & string)[]): Promise<T> {
    const columns = Object.keys(row)
    const placeholders = columns.map(() => '?').join(', ')
    const updates = (updateColumns ?? columns.filter((column) => column !== 'id')).map(
      (column) => `${column} = excluded.${column}`,
    )

    const conflict = updates.length === 0 ? 'DO NOTHING' : `DO UPDATE SET ${updates.join(', ')}`

    await this.db.run(
      `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(id) ${conflict}`,
      columns.map((column) => (row as Record<string, unknown>)[column]),
    )
    return this.persisted(row)
  }

  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | undefined> {
    const fields: Record<string, unknown> = { ...patch, updated_at: nowMs() }
    const columns = Object.keys(fields)
    await this.db.run(
      `UPDATE ${this.table} SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((column) => fields[column]), id],
    )
    return this.persisted(await this.findById(id))
  }

  async remove(id: string): Promise<RunResult> {
    const result = await this.db.run(`DELETE FROM ${this.table} WHERE id = ?`, [id])
    return this.persisted(result)
  }

  async findById(id: string): Promise<T | undefined> {
    const rows = await this.db.query<T>(`SELECT * FROM ${this.table} WHERE id = ?`, [id])
    return rows[0]
  }

  async list(options: ListOptions = {}): Promise<T[]> {
    const where = options.where ? `WHERE ${options.where}` : ''
    const order = options.orderBy ? `ORDER BY ${options.orderBy}` : ''
    const limit = options.limit === undefined ? '' : `LIMIT ${options.limit}`
    const offset = options.offset === undefined ? '' : `OFFSET ${options.offset}`
    return this.db.query<T>(
      `SELECT * FROM ${this.table} ${where} ${order} ${limit} ${offset}`.trim(),
      options.params ?? [],
    )
  }

  async count(where?: string, params: unknown[] = []): Promise<number> {
    const rows = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${this.table} ${where ? `WHERE ${where}` : ''}`,
      params,
    )
    return rows[0]?.total ?? 0
  }
}
