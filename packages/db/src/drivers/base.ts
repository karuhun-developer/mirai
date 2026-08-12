import type { Db, RunResult } from '../types.js'

/**
 * Bagian driver yang benar-benar menyentuh SQLite. Sengaja sesempit mungkin:
 * semantik transaksi ditulis sekali di berkas ini, bukan diulang di tiap
 * driver dengan tiga kesalahan yang berbeda.
 */
export interface Connection {
  query<T>(sql: string, params: unknown[]): Promise<T[]>
  run(sql: string, params: unknown[]): Promise<RunResult>
  execute(sql: string): Promise<void>
  /**
   * Batas transaksi dipegang driver, bukan dikirim sebagai SQL `BEGIN`. Plugin
   * native melacak status transaksinya sendiri dan akan bingung kalau ada
   * `BEGIN` yang datang lewat jalur `execute`.
   */
  begin(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
}

/**
 * SQLite hanya kenal `?` dengan nilai primitif. Boolean dan `undefined` tetap
 * lolos dari TypeScript lewat jalur `unknown[]`, dan kegagalannya baru muncul
 * sebagai "unsupported type" jauh dari sumbernya — jadi dinormalkan di sini.
 */
function normalize(params: unknown[]): unknown[] {
  return params.map((value) => {
    if (value === undefined) return null
    if (typeof value === 'boolean') return value ? 1 : 0
    return value
  })
}

/** Handle yang diberikan ke callback `transaction()`. */
class TxDb implements Db {
  readonly inTransaction = true

  constructor(private readonly connection: Connection) {}

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.connection.query<T>(sql, normalize(params))
  }

  run(sql: string, params: unknown[] = []): Promise<RunResult> {
    return this.connection.run(sql, normalize(params))
  }

  execute(sql: string): Promise<void> {
    return this.connection.execute(sql)
  }

  /**
   * Transaksi bersarang dijalankan inline. SQLite tidak punya nested
   * transaction, dan repository yang menerima handle ini memang bermaksud
   * "ikut transaksi yang sedang berjalan", bukan membuka yang baru.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return fn(this)
  }
}

/**
 * Handle utama. `transaction()` di sini benar-benar membuka transaksi, dan
 * memakai antrean supaya dua transaksi yang dimulai berbarengan tidak saling
 * menimpa `BEGIN`/`COMMIT` — SQLite cuma punya satu transaksi per koneksi.
 */
export class ConnectionDb implements Db {
  readonly inTransaction = false

  /** Ekor antrean transaksi; menunggu di sini = menunggu giliran. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly connection: Connection) {}

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.connection.query<T>(sql, normalize(params))
  }

  run(sql: string, params: unknown[] = []): Promise<RunResult> {
    return this.connection.run(sql, normalize(params))
  }

  execute(sql: string): Promise<void> {
    return this.connection.execute(sql)
  }

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const result = this.queue.then(() => this.runTransaction(fn))
    // Antrean tidak boleh putus karena satu transaksi gagal; error-nya sudah
    // diteruskan ke pemanggil lewat `result`.
    this.queue = result.catch(() => undefined)
    return result
  }

  private async runTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    const tx = new TxDb(this.connection)
    await this.connection.begin()
    try {
      const value = await fn(tx)
      await this.connection.commit()
      return value
    } catch (error) {
      // Rollback yang ikut gagal tidak boleh menutupi penyebab aslinya.
      await this.connection.rollback().catch(() => undefined)
      throw error
    }
  }
}
