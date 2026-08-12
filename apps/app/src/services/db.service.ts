import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import {
  CategoryRepository,
  EntryRepository,
  HistoryRepository,
  ItemRepository,
  SettingsRepository,
  flushPersist,
  getDb,
  initDb,
  isNativeDb,
  type Db,
} from '@mirai/db'

/**
 * Titik masuk database untuk app. Satu-satunya berkas di `apps/app` yang
 * memanggil `initDb()`; sisanya cuma memakai repository dari `repos()`.
 *
 * Berkas `.wasm` diimpor sebagai URL supaya Vite yang mengurus hashing dan
 * penyalinannya ke `dist/`. Tanpa `locateFile`, `sql.js` menebak lokasi WASM
 * relatif terhadap berkas glue-nya — tebakan yang salah begitu bundel-nya
 * dipindah ke `assets/` dengan nama ber-hash.
 */

export interface Repos {
  entries: EntryRepository
  items: ItemRepository
  categories: CategoryRepository
  history: HistoryRepository
  settings: SettingsRepository
}

let cache: Repos | null = null

export async function setupDb(): Promise<Db> {
  const db = await initDb({ locateFile: () => wasmUrl })
  exposeForSmoke()
  return db
}

/**
 * Repository dibuat sekali dan dipakai bersama. Aman karena keduanya tanpa
 * keadaan: yang dipegang cuma handle `Db`.
 */
export function repos(): Repos {
  cache ??= {
    entries: new EntryRepository(getDb()),
    items: new ItemRepository(getDb()),
    categories: new CategoryRepository(getDb()),
    history: new HistoryRepository(getDb()),
    settings: new SettingsRepository(getDb()),
  }
  return cache
}

/**
 * Jendela kecil ke database untuk `scripts/smoke.mjs`.
 *
 * Smoke test memverifikasi bahwa yang tampil di layar memang berasal dari
 * baris yang tersimpan — bukan dari state Vue yang kebetulan masih hidup. Cuma
 * dipasang saat dev: build produksi tidak perlu memberi siapa pun jalur SQL
 * mentah dari konsol.
 */
function exposeForSmoke(): void {
  if (!import.meta.env.DEV) return
  const bridge = {
    query: (sql: string, params: unknown[] = []) => getDb().query(sql, params),
    // Menulis dipakai untuk memasang keadaan awal yang tidak bisa didapat dari
    // jaringan — mis. satu anime beserta episodenya waktu situs sumbernya tidak
    // terjangkau dari mesin pengembangan.
    run: (sql: string, params: unknown[] = []) => getDb().run(sql, params),
    flush: () => flushPersist(),
    native: () => isNativeDb(),
  }
  ;(globalThis as unknown as { __db?: typeof bridge }).__db = bridge
}
