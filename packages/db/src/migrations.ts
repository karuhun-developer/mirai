import type { Db, Migration } from './types.js'
import { nowMs } from './util.js'

/**
 * Migrasi bernomor, dijalankan berurutan, tiap satu dalam transaksinya sendiri.
 *
 * Aturan yang tidak boleh dilanggar: **migrasi yang sudah pernah dirilis tidak
 * diedit lagi.** Perangkat yang sudah menjalankannya tidak akan mengulang, jadi
 * mengubah isinya berarti dua perangkat dengan versi app yang sama punya skema
 * berbeda. Perubahan skema selalu jadi migrasi baru dengan nomor berikutnya.
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS entry (
          id TEXT PRIMARY KEY NOT NULL,
          kind TEXT NOT NULL,
          source_id TEXT NOT NULL,
          url TEXT NOT NULL,
          title TEXT NOT NULL,
          thumbnail_url TEXT,
          author TEXT,
          artist TEXT,
          description TEXT,
          genre TEXT,
          status TEXT,
          studio TEXT,
          total_episodes INTEGER,
          favorite INTEGER NOT NULL DEFAULT 0,
          added_at INTEGER,
          details_at INTEGER,
          items_at INTEGER,
          updated_at INTEGER NOT NULL
        );

        -- Library selalu di-query "favorit, per jenis"; tanpa index ini setiap
        -- pembukaan tab memindai seluruh tabel termasuk entri katalog sesaat.
        CREATE INDEX IF NOT EXISTS idx_entry_library ON entry(kind, favorite);
        CREATE INDEX IF NOT EXISTS idx_entry_source ON entry(source_id);

        CREATE TABLE IF NOT EXISTS category (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_category_kind ON category(kind, sort_order);

        CREATE TABLE IF NOT EXISTS entry_category (
          entry_id TEXT NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
          category_id TEXT NOT NULL REFERENCES category(id) ON DELETE CASCADE,
          added_at INTEGER NOT NULL,
          PRIMARY KEY (entry_id, category_id)
        );

        CREATE INDEX IF NOT EXISTS idx_entry_category_category
          ON entry_category(category_id);

        CREATE TABLE IF NOT EXISTS item (
          id TEXT PRIMARY KEY NOT NULL,
          entry_id TEXT NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          name TEXT NOT NULL,
          number REAL,
          date_upload INTEGER,
          scanlator TEXT,
          filler INTEGER NOT NULL DEFAULT 0,
          seen INTEGER NOT NULL DEFAULT 0,
          last_position INTEGER NOT NULL DEFAULT 0,
          total_position INTEGER,
          bookmark INTEGER NOT NULL DEFAULT 0,
          downloaded INTEGER NOT NULL DEFAULT 0,
          sort_index INTEGER NOT NULL DEFAULT 0,
          added_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_item_entry ON item(entry_id, sort_index);
        -- Badge "belum dibaca" menghitung per entri; ini yang membuatnya murah
        -- walau library berisi ratusan judul.
        CREATE INDEX IF NOT EXISTS idx_item_unseen ON item(entry_id, seen);
        -- Halaman Updates mengurutkan seluruh item berdasarkan kapan terlihat.
        CREATE INDEX IF NOT EXISTS idx_item_added ON item(added_at);

        CREATE TABLE IF NOT EXISTS history (
          item_id TEXT PRIMARY KEY NOT NULL
            REFERENCES item(id) ON DELETE CASCADE,
          entry_id TEXT NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
          read_at INTEGER NOT NULL,
          position INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_history_read_at ON history(read_at);

        CREATE TABLE IF NOT EXISTS download (
          id TEXT PRIMARY KEY NOT NULL,
          item_id TEXT NOT NULL REFERENCES item(id) ON DELETE CASCADE,
          entry_id TEXT NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
          state TEXT NOT NULL,
          progress INTEGER NOT NULL DEFAULT 0,
          path TEXT,
          error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_download_state ON download(state);

        CREATE TABLE IF NOT EXISTS setting (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `)
    },
  },
]

/** Menjalankan migrasi yang belum pernah di-apply, berurutan. */
export async function runMigrations(db: Db): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `)

  const applied = await db.query<{ version: number }>('SELECT version FROM schema_migrations')
  const done = new Set(applied.map((row) => row.version))

  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (done.has(migration.version)) continue
    // Satu transaksi per migrasi: migrasi yang gagal di tengah tidak boleh
    // meninggalkan setengah tabel yang membuat migrasi berikutnya ikut gagal.
    await db.transaction(async (tx) => {
      await migration.up(tx)
      await tx.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        migration.version,
        migration.name,
        nowMs(),
      ])
    })
  }
}
