import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'
import type { Db, RunResult } from '../types.js'
import { ConnectionDb, type Connection } from './base.js'

/**
 * Driver native (APK). SQLite di sini adalah SQLite sungguhan yang menulis ke
 * berkas, jadi tidak ada snapshot yang perlu diselamatkan: begitu transaksi
 * commit, datanya sudah di disk.
 *
 * ⚠️ Belum pernah dijalankan di perangkat — Android SDK belum terpasang di
 * mesin pengembangan (lihat Fase 8 di roadmap). Yang menjaga jalur ini tetap
 * jujur adalah kesamaan bentuknya dengan driver web: keduanya
 * mengimplementasikan `Connection` yang sama dan dipakai lewat `Db` yang sama.
 */

const DB_VERSION = 1

class NativeConnection implements Connection {
  constructor(private readonly conn: SQLiteDBConnection) {}

  async query<T>(sql: string, params: unknown[]): Promise<T[]> {
    const result = await this.conn.query(sql, params as never[])
    return (result.values ?? []) as T[]
  }

  async run(sql: string, params: unknown[]): Promise<RunResult> {
    // `transaction: false` — commit dikendalikan `ConnectionDb`, bukan plugin.
    // Kalau dibiarkan true, tiap `run` menutup transaksi yang sedang berjalan.
    const result = await this.conn.run(sql, params as never[], false)
    return { changes: result.changes?.changes ?? 0 }
  }

  async execute(sql: string): Promise<void> {
    await this.conn.execute(sql, false)
  }

  async begin(): Promise<void> {
    await this.conn.beginTransaction()
  }

  async commit(): Promise<void> {
    // Plugin sudah menutup transaksinya sendiri pada beberapa jalur error;
    // commit ganda dijawab dengan exception, bukan diabaikan.
    if (await this.conn.isTransactionActive()) await this.conn.commitTransaction()
  }

  async rollback(): Promise<void> {
    if (await this.conn.isTransactionActive()) await this.conn.rollbackTransaction()
  }
}

export interface NativeHandle {
  db: Db
  close: () => Promise<void>
}

export async function createNativeDb(name: string): Promise<NativeHandle> {
  const sqlite = new SQLiteConnection(CapacitorSQLite)

  // Koneksi lama dipakai ulang: hot reload dan `cap run` yang mengulang boot
  // akan gagal dengan "connection already exists" kalau selalu membuat baru.
  const existing = (await sqlite.isConnection(name, false)).result
  const conn = existing
    ? await sqlite.retrieveConnection(name, false)
    : await sqlite.createConnection(name, false, 'no-encryption', DB_VERSION, false)

  await conn.open()
  await conn.execute('PRAGMA foreign_keys = ON;', false)

  return {
    db: new ConnectionDb(new NativeConnection(conn)),
    close: async () => {
      await conn.close()
      await sqlite.closeConnection(name, false)
    },
  }
}
