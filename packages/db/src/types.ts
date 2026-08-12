/**
 * Kontrak database. Repository dan service hanya mengenal berkas ini — tidak
 * ada satu pun lapisan di atas DB yang boleh menyentuh `sql.js` atau plugin
 * Capacitor secara langsung. Itu yang membuat driver web dan native bisa
 * ditukar tanpa mengubah satu baris pun kode fitur.
 */

export interface RunResult {
  changes: number
}

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  run(sql: string, params?: unknown[]): Promise<RunResult>
  /** DDL multi-statement; dipakai migrasi. */
  execute(sql: string): Promise<void>
  /**
   * Menjalankan `fn` dalam satu transaksi atomik. **Reentrant**: kalau sudah di
   * dalam transaksi, `fn` ikut transaksi yang sedang berjalan alih-alih membuka
   * yang baru. SQLite tidak punya nested transaction, dan tanpa sifat ini satu
   * repository yang memanggil repository lain akan meng-commit lebih awal.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>
  /**
   * True kalau handle ini adalah transaksi yang sedang aktif. Repository
   * memakainya untuk menunda `persist()` sampai transaksi terluar selesai —
   * menulis snapshot di tengah transaksi menyimpan keadaan setengah jadi.
   */
  readonly inTransaction: boolean
}

export interface Migration {
  version: number
  name: string
  up: (db: Db) => Promise<void>
}

// ── Baris tabel ──────────────────────────────────────────────────────────────
//
// Semua kolom boolean disimpan sebagai INTEGER 0/1: SQLite tidak punya tipe
// boolean, dan menyimpannya sebagai teks berarti setiap query harus tahu
// apakah nilainya `'true'` atau `'1'`.
//
// Tidak ada kolom sync (`dirty`, `sync_version`, `remote_id`) — Mirai lokal
// saja. `updated_at` tetap ada karena backup/restore (Fase 9) butuh tahu baris
// mana yang lebih baru.

export type EntryKind = 'manga' | 'anime'

export interface EntryRow {
  /** `${source_id}::${url}` — deterministik, jadi entri yang sama dari sumber
   *  yang sama tidak pernah tergandakan meski ditemukan lewat jalur berbeda. */
  id: string
  kind: EntryKind
  source_id: string
  /** Identitas entri di source-nya, apa adanya dari `SEntry.url`. */
  url: string
  title: string
  thumbnail_url: string | null
  author: string | null
  artist: string | null
  description: string | null
  /** JSON array; SQLite tidak punya tipe larik dan genre tidak pernah di-query. */
  genre: string | null
  status: string | null
  studio: string | null
  total_episodes: number | null
  favorite: number
  /** Kapan ditambahkan ke library. Null berarti belum pernah difavoritkan. */
  added_at: number | null
  /** Kapan `getDetails()` terakhir berhasil; null = baru dari katalog. */
  details_at: number | null
  /** Kapan daftar chapter/episode terakhir disegarkan. */
  items_at: number | null
  updated_at: number
}

export interface CategoryRow {
  id: string
  name: string
  /** Kategori dipisah per jenis: tab Anime dan Manga tidak berbagi daftar. */
  kind: EntryKind
  sort_order: number
  updated_at: number
}

export interface EntryCategoryRow {
  entry_id: string
  category_id: string
  added_at: number
}

/**
 * Chapter dan episode dalam satu tabel. Keduanya adalah "satu satuan yang
 * dibaca/ditonton dari satu entri" dengan kolom yang sama persis kecuali nama
 * bidangnya; memisahnya berarti menggandakan repository, query Updates, dan
 * antrean unduhan tanpa menambah satu pun aturan yang berbeda.
 */
export interface ItemRow {
  /** `${entry_id}::${url}`. */
  id: string
  entry_id: string
  url: string
  name: string
  /** Nomor chapter/episode untuk pengurutan; null kalau source tidak memberi. */
  number: number | null
  date_upload: number | null
  scanlator: string | null
  filler: number
  seen: number
  /** Halaman terakhir (manga) atau detik terakhir (anime). */
  last_position: number
  /** Total halaman/durasi; dipakai menghitung progres tanpa membuka itemnya. */
  total_position: number | null
  bookmark: number
  downloaded: number
  /** Urutan asli dari source; jaring pengaman waktu `number` kosong semua. */
  sort_index: number
  /** Kapan item ini pertama terlihat — dasar daftar Updates. */
  added_at: number
  updated_at: number
}

export interface HistoryRow {
  /** Satu baris per item: riwayat yang dipakai adalah "terakhir kapan". */
  item_id: string
  entry_id: string
  read_at: number
  position: number
}

export type DownloadState = 'queued' | 'running' | 'done' | 'failed' | 'paused'

export interface DownloadRow {
  id: string
  item_id: string
  entry_id: string
  state: DownloadState
  /** 0–100. Kasar dengan sengaja: progres byte per byte tidak layak ditulis ke DB. */
  progress: number
  /** Direktori hasil unduhan di Filesystem/OPFS. Berkasnya sendiri tidak di DB. */
  path: string | null
  error: string | null
  created_at: number
  updated_at: number
}

export interface SettingRow {
  key: string
  value: string
  updated_at: number
}
