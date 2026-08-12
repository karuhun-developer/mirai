import { Capacitor } from '@capacitor/core'
import type { Db } from './types.js'
import { runMigrations } from './migrations.js'
import { loadSnapshot, saveSnapshot } from './persist.js'
import type { SqlJsOptions } from './drivers/sqljs.js'

/**
 * Siklus hidup database: satu instance untuk seluruh app, dipilih drivernya
 * berdasarkan platform, dimigrasi sekali di awal.
 *
 * Driver-nya di-`import()` dinamis, bukan di atas berkas. Tanpa itu build web
 * ikut membawa plugin Capacitor yang tidak akan pernah dipanggil, dan APK ikut
 * membawa 650 KB WebAssembly `sql.js` yang juga tidak akan pernah dipanggil.
 */

const DB_NAME = 'mirai'

/** Jeda pengumpulan sebelum snapshot ditulis; lihat `persist()`. */
const PERSIST_DELAY = 250

export interface InitDbOptions extends Pick<SqlJsOptions, 'locateFile'> {
  /** Memaksa driver web walau berjalan di native. Dipakai test dan diagnosis. */
  forceWeb?: boolean
}

let db: Db | null = null
let initPromise: Promise<Db> | null = null
let native = false
let exportSnapshot: (() => Uint8Array) | null = null
let closeDriver: (() => void | Promise<void>) | null = null

export async function initDb(options: InitDbOptions = {}): Promise<Db> {
  if (db) return db
  if (initPromise) return initPromise

  initPromise = (async () => {
    native = !options.forceWeb && Capacitor.isNativePlatform()

    if (native) {
      const { createNativeDb } = await import('./drivers/native.js')
      const handle = await createNativeDb(DB_NAME)
      db = handle.db
      closeDriver = handle.close
    } else {
      const { createSqlJsDb } = await import('./drivers/sqljs.js')
      const data = await loadSnapshot(DB_NAME)
      const handle = await createSqlJsDb({
        ...(options.locateFile ? { locateFile: options.locateFile } : {}),
        ...(data ? { data } : {}),
      })
      db = handle.db
      exportSnapshot = handle.export
      closeDriver = handle.close
      installUnloadFlush()
    }

    await runMigrations(db)
    // Skema baru harus ikut tersimpan sekarang juga: kalau tab ditutup sebelum
    // write pertama, boot berikutnya akan menjalankan migrasi dari nol lagi.
    await flushPersist()

    return db
  })()

  return initPromise
}

export function getDb(): Db {
  if (!db) throw new Error('Database belum siap — panggil initDb() dulu sebelum memakai getDb()')
  return db
}

export function isNativeDb(): boolean {
  return native
}

// ── Snapshot ─────────────────────────────────────────────────────────────────

let waiting: { promise: Promise<void>; resolve: () => void } | null = null
let timer: ReturnType<typeof setTimeout> | null = null

/**
 * Menandai bahwa isi database berubah dan snapshot perlu ditulis ulang.
 *
 * Penulisannya dikumpulkan: mengimpor satu daftar chapter berarti puluhan
 * write, dan mengekspor seluruh database untuk masing-masingnya membuat impor
 * yang seharusnya sekejap jadi terasa menggantung. Jeda `PERSIST_DELAY` tidak
 * diperpanjang oleh panggilan berikutnya — kalau tidak, aliran write yang
 * rapat bisa menunda snapshot tanpa batas.
 *
 * Tidak pernah melempar: barisnya sudah ada di database, yang gagal cuma
 * ketahanannya. Kegagalan yang sesungguhnya perlu diketahui pemanggil ada di
 * `flushPersist()`.
 */
export function persist(): Promise<void> {
  if (native || !exportSnapshot) return Promise.resolve()

  if (!waiting) {
    let resolve!: () => void
    const promise = new Promise<void>((done) => {
      resolve = done
    })
    waiting = { promise, resolve }
  }

  if (timer === null) {
    timer = setTimeout(() => {
      void flushPersist().catch((error: unknown) => {
        console.warn('[mirai/db] snapshot gagal disimpan', error)
      })
    }, PERSIST_DELAY)
  }

  return waiting.promise
}

/** Menulis snapshot sekarang juga. Melempar kalau penyimpanannya menolak. */
export async function flushPersist(): Promise<void> {
  if (native || !exportSnapshot) return

  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  const pending = waiting
  waiting = null

  try {
    await saveSnapshot(DB_NAME, exportSnapshot())
  } finally {
    // Yang menunggu tetap dilepas apa pun hasilnya; menggantung selamanya jauh
    // lebih buruk daripada snapshot yang gagal sekali.
    pending?.resolve()
  }
}

/**
 * Menutup tab adalah cara paling umum data 250 ms terakhir hilang. `pagehide`
 * dipilih karena `beforeunload` tidak dijalankan di Safari iOS dan di WebView
 * saat aplikasi dipindah ke latar belakang.
 */
function installUnloadFlush(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('pagehide', () => {
    void flushPersist().catch(() => undefined)
  })
}

export async function closeDb(): Promise<void> {
  await flushPersist().catch(() => undefined)
  await closeDriver?.()
  db = null
  initPromise = null
  exportSnapshot = null
  closeDriver = null
  native = false
}
