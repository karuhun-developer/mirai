import { persist } from '../db.js'
import type { Db, SettingRow } from '../types.js'
import { nowMs } from '../util.js'

/**
 * Key-value untuk setelan yang **milik data**, bukan milik perangkat: cara
 * library diurutkan, kategori yang terakhir dibuka, ambang "sudah dibaca".
 * Semuanya ikut waktu backup/restore (Fase 9), dan itulah alasannya berada di
 * database alih-alih `localStorage`.
 *
 * Setelan yang justru tidak boleh ikut berpindah perangkat — User-Agent, URL
 * proxy — tetap di `localStorage` lewat `settings.service.ts`.
 */
export class SettingsRepository {
  constructor(private readonly db: Db) {}

  async get(key: string): Promise<string | undefined> {
    const rows = await this.db.query<SettingRow>('SELECT * FROM setting WHERE key = ?', [key])
    return rows[0]?.value
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.run(
      `INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, nowMs()],
    )
    if (!this.db.inTransaction) await persist()
  }

  /**
   * JSON yang gagal di-parse dianggap tidak ada. Setelan rusak — versi lama,
   * penulisan yang terpotong — tidak boleh membuat halaman yang membacanya
   * gagal dimuat sama sekali.
   */
  async getJson<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.get(key)
    if (raw === undefined) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  setJson(key: string, value: unknown): Promise<void> {
    return this.set(key, JSON.stringify(value))
  }

  async remove(key: string): Promise<void> {
    await this.db.run('DELETE FROM setting WHERE key = ?', [key])
    if (!this.db.inTransaction) await persist()
  }
}
