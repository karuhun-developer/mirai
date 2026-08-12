/**
 * @mirai/db — SQLite untuk library, riwayat, dan progres.
 *
 * Satu-satunya paket yang tahu bentuk penyimpanan. Lapisan di atasnya
 * (service → store → UI) cuma mengenal `Db` dan repository; tidak ada satu pun
 * komponen Vue yang menulis SQL.
 */

export { closeDb, flushPersist, getDb, initDb, isNativeDb, persist } from './db.js'
export type { InitDbOptions } from './db.js'

export { migrations, runMigrations } from './migrations.js'
export { decodeGenre, toEntryRow, toItemRow, toSEntry, toSItem } from './mapping.js'
export { entryId, fromFlag, itemId, nowMs, parseEntryId, randomId, toFlag } from './util.js'

export { loadSnapshot, saveSnapshot, dropSnapshot } from './persist.js'

// Driver sengaja tidak diekspor sebagai nilai dari sini. Satu `export` biasa
// saja sudah membuat bundler menarik driver ke chunk utama dan membatalkan
// `import()` dinamis di `db.ts` — web ikut membawa 650 KB WebAssembly `sql.js`
// yang di APK tidak pernah dipanggil. Tipe aman karena hilang saat kompilasi;
// yang butuh fungsinya (mis. test) mengimpor langsung dari `./drivers/*.js`.
export type { SqlJsHandle, SqlJsOptions } from './drivers/sqljs.js'

export { BaseRepository } from './repositories/base.js'
export type { BaseRow, ListOptions } from './repositories/base.js'
export { EntryRepository } from './repositories/entries.js'
export type { LibraryEntry, LibraryQuery, LibrarySort } from './repositories/entries.js'
export { ItemRepository } from './repositories/items.js'
export type { ItemWithEntry, SyncResult } from './repositories/items.js'
export { CategoryRepository } from './repositories/categories.js'
export { HistoryRepository } from './repositories/history.js'
export type { HistoryEntry } from './repositories/history.js'
export { SettingsRepository } from './repositories/settings.js'

export type {
  CategoryRow,
  Db,
  DownloadRow,
  DownloadState,
  EntryCategoryRow,
  EntryKind,
  EntryRow,
  HistoryRow,
  ItemRow,
  Migration,
  RunResult,
  SettingRow,
} from './types.js'
