import initSqlJs, { type Database } from 'sql.js'
import type { Db, RunResult } from '../types.js'
import { ConnectionDb, type Connection } from './base.js'

/**
 * Driver web. `sql.js` adalah SQLite yang dikompilasi ke WebAssembly dan
 * seluruh isinya ada di memori — tidak ada berkas database di browser. Karena
 * itu ketahanannya bergantung pada snapshot: `export()` menghasilkan berkas
 * SQLite utuh yang disimpan ke IndexedDB (lihat `persist.ts`).
 *
 * Versi `sql.js` dipin persis di package.json. Glue JS dan berkas `.wasm`-nya
 * adalah satu pasang; menaikkan salah satunya sendirian menghasilkan kegagalan
 * inisialisasi yang pesannya tidak menyebut versi sama sekali.
 */

export interface SqlJsOptions {
  /**
   * Menentukan dari mana `sql-wasm.wasm` diambil. Wajib diisi di app: bundler
   * menaruhnya dengan nama ber-hash, dan tebakan bawaan `sql.js` (relatif
   * terhadap dokumen) hampir selalu meleset. Di Node boleh dikosongkan.
   */
  locateFile?: (file: string) => string
  /** Snapshot dari penyimpanan; kosong berarti database baru. */
  data?: Uint8Array
}

export interface SqlJsHandle {
  db: Db
  /** Isi database sebagai berkas SQLite utuh, siap disimpan. */
  export: () => Uint8Array
  close: () => void
}

class SqlJsConnection implements Connection {
  constructor(private readonly database: Database) {}

  query<T>(sql: string, params: unknown[]): Promise<T[]> {
    const statement = this.database.prepare(sql)
    try {
      statement.bind(params as never)
      const rows: T[] = []
      while (statement.step()) rows.push(statement.getAsObject() as T)
      return Promise.resolve(rows)
    } finally {
      // Statement yang tidak di-free membocorkan memori WASM sampai tab
      // ditutup — dan di halaman library yang tiap render menembak beberapa
      // query, itu terasa dalam hitungan menit.
      statement.free()
    }
  }

  run(sql: string, params: unknown[]): Promise<RunResult> {
    this.database.run(sql, params as never)
    return Promise.resolve({ changes: this.database.getRowsModified() })
  }

  execute(sql: string): Promise<void> {
    this.database.exec(sql)
    return Promise.resolve()
  }

  begin(): Promise<void> {
    return this.execute('BEGIN')
  }

  commit(): Promise<void> {
    return this.execute('COMMIT')
  }

  rollback(): Promise<void> {
    return this.execute('ROLLBACK')
  }
}

export async function createSqlJsDb(options: SqlJsOptions = {}): Promise<SqlJsHandle> {
  const SQL = await initSqlJs(options.locateFile ? { locateFile: options.locateFile } : undefined)
  const database = options.data ? new SQL.Database(options.data) : new SQL.Database()

  // Foreign key di SQLite mati secara bawaan, per koneksi. Tanpa baris ini
  // menghapus entri meninggalkan chapter dan riwayatnya jadi sampah permanen.
  database.exec('PRAGMA foreign_keys = ON;')

  return {
    db: new ConnectionDb(new SqlJsConnection(database)),
    export: () => database.export(),
    close: () => database.close(),
  }
}
