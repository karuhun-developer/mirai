/**
 * Snapshot database untuk build web.
 *
 * `sql.js` hidup sepenuhnya di memori, jadi ketahanan datanya adalah urusan
 * berkas ini: seluruh isi database diekspor sebagai satu berkas SQLite lalu
 * disimpan di IndexedDB. localStorage bukan pilihan — kuotanya beberapa MB dan
 * hanya menerima string, yang berarti base64 dan pembengkakan 33%.
 */

const IDB_NAME = 'mirai-db'
const IDB_VERSION = 1
const STORE = 'snapshot'

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION)
    request.onupgradeneeded = () => {
      const idb = request.result
      if (!idb.objectStoreNames.contains(STORE)) idb.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB tidak bisa dibuka'))
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openIdb().then(
    (idb) =>
      new Promise<T>((resolve, reject) => {
        const tx = idb.transaction(STORE, mode)
        const request = work(tx.objectStore(STORE))
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error ?? new Error('Operasi IndexedDB gagal'))
        tx.oncomplete = () => idb.close()
      }),
  )
}

export async function loadSnapshot(key: string): Promise<Uint8Array | undefined> {
  try {
    const value = await withStore<unknown>('readonly', (store) => store.get(key))
    if (value instanceof Uint8Array) return value
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    return undefined
  } catch {
    // Snapshot rusak atau IndexedDB diblokir (mode privat sebagian browser)
    // berarti mulai dari database kosong. App yang tetap jalan tanpa library
    // lebih berguna daripada app yang menolak dibuka.
    return undefined
  }
}

export async function saveSnapshot(key: string, data: Uint8Array): Promise<void> {
  // Salinan dibuat karena buffer dari WASM bisa terlepas (detached) begitu
  // `sql.js` menumbuhkan heap-nya, dan IndexedDB menulis secara asinkron.
  const copy = new Uint8Array(data)
  await withStore('readwrite', (store) => store.put(copy, key))
}

export async function dropSnapshot(key: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(key))
}
