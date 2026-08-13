import { Capacitor } from '@capacitor/core'
import { t } from '@/i18n'

/**
 * Berkas hasil unduhan.
 *
 * Dua dunia yang berbeda dikurung di satu berkas ini:
 *
 * - **APK** memakai plugin Filesystem di `Directory.Data` — direktori privat
 *   aplikasi, ikut terhapus waktu app di-uninstall dan tidak butuh izin
 *   penyimpanan apa pun.
 * - **Web** memakai OPFS (Origin Private File System). Bukan Cache API dan bukan
 *   IndexedDB: OPFS punya direktori sungguhan, jadi struktur `<judul>/<chapter>/001.jpg`
 *   yang sama bisa dipakai di kedua sisi, dan menghapus satu chapter cukup
 *   menghapus satu direktori.
 *
 * Yang tidak dijanjikan di web: browser boleh membuang OPFS kalau ruang menipis
 * (kecuali penyimpanannya "persisted"). Karena itu `requestPersistence()` ada,
 * dan kegagalannya tidak mematikan apa pun — chapter yang hilang bisa diunduh
 * ulang, sedangkan progres bacanya ada di SQLite yang punya snapshot sendiri.
 */

const native = Capacitor.isNativePlatform()

/** Ukuran hasil satu unduhan, dipakai menghitung pemakaian ruang. */
export interface SavedFile {
  path: string
  bytes: number
}

// ── Web: OPFS ────────────────────────────────────────────────────────────────

async function opfsRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory()
}

/**
 * Menelusuri (dan opsional membuat) direktori bertingkat.
 *
 * OPFS tidak punya `mkdir -p`; tiap ruas harus diminta satu per satu. Yang
 * mengembalikan `null` adalah jalur yang memang belum ada — dipakai fungsi baca
 * dan hapus supaya keduanya tidak perlu melempar error untuk keadaan normal.
 */
async function opfsDir(path: string, create: boolean): Promise<FileSystemDirectoryHandle | null> {
  let handle = await opfsRoot()
  for (const segment of path.split('/').filter(Boolean)) {
    try {
      handle = await handle.getDirectoryHandle(segment, { create })
    } catch {
      return null
    }
  }
  return handle
}

async function opfsWrite(path: string, data: Blob): Promise<void> {
  const at = path.lastIndexOf('/')
  const dir = await opfsDir(path.slice(0, at), true)
  if (!dir) throw new Error(t('errors.dirFailed', { path }))

  const file = await dir.getFileHandle(path.slice(at + 1), { create: true })
  const stream = await file.createWritable()
  await stream.write(data)
  await stream.close()
}

async function opfsFile(path: string): Promise<File | null> {
  const at = path.lastIndexOf('/')
  const dir = await opfsDir(path.slice(0, at), false)
  if (!dir) return null
  try {
    return await (await dir.getFileHandle(path.slice(at + 1))).getFile()
  } catch {
    return null
  }
}

// ── Native: plugin Filesystem ────────────────────────────────────────────────

/**
 * Plugin di-`import()` dinamis dan cuma di native — build web tidak perlu ikut
 * membawa kode yang tidak akan pernah dipanggil, pola yang sama dengan driver
 * database dan kunci orientasi.
 */
async function filesystem() {
  return import('@capacitor/filesystem')
}

// ── API yang dipakai lapisan di atasnya ──────────────────────────────────────

/**
 * Mengunduh satu alamat langsung ke berkas.
 *
 * Jalannya berbeda jauh di dua sisi, dan bedanya bukan gaya:
 *
 * - Di **native**, `Filesystem.downloadFile` melakukan HTTP-nya di sisi Java.
 *   Itu satu-satunya cara memasang `Referer` yang diminta CDN manga tanpa
 *   menyentuh CORS sama sekali, sekaligus menghindari memuat seluruh gambar ke
 *   memori JavaScript.
 * - Di **web**, alamatnya harus sudah berupa alamat proxy (`resolvedUrl`) karena
 *   `fetch` dari halaman tidak boleh memasang `Referer` dan CDN-nya tidak
 *   mengirim header CORS.
 *
 * `onProgress` (0–1) opsional dan cuma dipakai berkas besar — satu video utuh.
 * Halaman manga tidak memakainya: laporan per byte untuk berkas 200 KB cuma
 * membanjiri UI dengan pembaruan yang tidak ada bedanya di mata.
 */
export async function downloadFile(
  path: string,
  url: string,
  resolvedUrl: string,
  headers?: Readonly<Record<string, string>>,
  onProgress?: (ratio: number) => void,
): Promise<SavedFile> {
  if (native) {
    const { Filesystem, Directory } = await filesystem()

    // Peristiwa progresnya global untuk seluruh plugin, bukan per pemanggil, jadi
    // beberapa unduhan yang jalan bersamaan saling mendengar kabar satu sama lain
    // — makanya disaring per alamat.
    const listener = onProgress
      ? await Filesystem.addListener('progress', (status) => {
          if (status.url === url && status.contentLength > 0) {
            onProgress(Math.min(status.bytes / status.contentLength, 1))
          }
        })
      : null

    try {
      await Filesystem.downloadFile({
        path,
        url,
        directory: Directory.Data,
        recursive: true,
        progress: listener !== null,
        ...(headers ? { headers: { ...headers } } : {}),
      })
    } finally {
      await listener?.remove()
    }

    const stat = await Filesystem.stat({ path, directory: Directory.Data })
    return { path, bytes: stat.size }
  }

  const response = await fetch(resolvedUrl)
  if (!response.ok) throw new Error(t('errors.fileHttp', { status: response.status }))

  const blob = onProgress ? await readWithProgress(response, onProgress) : await response.blob()
  // Respons kosong hampir selalu berarti proxy meneruskan halaman error, dan
  // menyimpannya berarti chapter "terunduh" yang halamannya kosong melompong.
  if (blob.size === 0) throw new Error(t('errors.emptyFile'))

  await opfsWrite(path, blob)
  return { path, bytes: blob.size }
}

/**
 * Membaca respons potongan demi potongan supaya progresnya bisa dilaporkan.
 *
 * Tanpa `Content-Length` — proxy yang meneruskan respons berkode chunked, misalnya
 * — rasionya tidak bisa dihitung, dan yang dilaporkan cuma "sudah mulai": lebih
 * jujur daripada bilah yang bergerak berdasarkan angka karangan.
 */
async function readWithProgress(
  response: Response,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const total = Number.parseInt(response.headers.get('content-length') ?? '', 10)
  const reader = response.body?.getReader()
  if (!reader) return response.blob()

  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    if (Number.isFinite(total) && total > 0) onProgress(Math.min(received / total, 1))
  }

  return new Blob(chunks as BlobPart[])
}

/**
 * Menulis berkas teks — sejauh ini cuma playlist HLS hasil unduhan.
 *
 * Dipisah dari `downloadFile()` karena isinya lahir di aplikasi, bukan diambil
 * dari jaringan: playlist yang tersimpan sudah ditulis ulang supaya menunjuk
 * berkas di perangkat, dan tidak ada alamat yang bisa diunduh untuk itu.
 */
export async function writeText(path: string, text: string): Promise<SavedFile> {
  const bytes = new TextEncoder().encode(text).byteLength

  if (native) {
    const { Filesystem, Directory, Encoding } = await filesystem()
    await Filesystem.writeFile({
      path,
      data: text,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    return { path, bytes }
  }

  await opfsWrite(path, new Blob([text], { type: 'text/plain' }))
  return { path, bytes }
}

/** Isi berkas teks; `null` kalau berkasnya tidak ada. */
export async function readText(path: string): Promise<string | null> {
  if (native) {
    const { Filesystem, Directory, Encoding } = await filesystem()
    try {
      const { data } = await Filesystem.readFile({
        path,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      })
      // Pluginnya mengembalikan `Blob` di web dan `string` di native; jalur ini
      // memang cuma native, tapi tipenya menuntut keduanya ditangani.
      return typeof data === 'string' ? data : await data.text()
    } catch {
      return null
    }
  }

  const file = await opfsFile(path)
  return file ? file.text() : null
}

/**
 * Alamat yang bisa dipasang ke `<img>`/`<video>`.
 *
 * Di native jadi `capacitor://…` lewat `convertFileSrc`; di web jadi `blob:`
 * yang **wajib dicabut** pemanggilnya dengan `revokeFileUrl()` — object URL
 * menahan seluruh isi berkasnya di memori sampai halamannya ditutup.
 */
export async function fileUrl(path: string): Promise<string | null> {
  if (native) {
    const { Filesystem, Directory } = await filesystem()
    try {
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Data })
      return Capacitor.convertFileSrc(uri)
    } catch {
      return null
    }
  }

  const file = await opfsFile(path)
  return file ? URL.createObjectURL(file) : null
}

export function revokeFileUrl(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}

/** Isi sebuah direktori, urut nama — inilah urutan halaman sebuah chapter. */
export async function listDir(path: string): Promise<string[]> {
  if (native) {
    const { Filesystem, Directory } = await filesystem()
    try {
      const { files } = await Filesystem.readdir({ path, directory: Directory.Data })
      return files.map((file) => file.name).sort()
    } catch {
      return []
    }
  }

  const dir = await opfsDir(path, false)
  if (!dir) return []

  const names: string[] = []
  for await (const name of dir.keys()) names.push(name)
  return names.sort()
}

/** Menghapus satu direktori beserta isinya. Yang sudah tidak ada bukan kegagalan. */
export async function removeDir(path: string): Promise<void> {
  if (native) {
    const { Filesystem, Directory } = await filesystem()
    try {
      await Filesystem.rmdir({ path, directory: Directory.Data, recursive: true })
    } catch {
      // Sudah terhapus, atau tidak pernah ada.
    }
    return
  }

  const at = path.lastIndexOf('/')
  const parent = await opfsDir(at === -1 ? '' : path.slice(0, at), false)
  if (!parent) return
  try {
    await parent.removeEntry(path.slice(at + 1), { recursive: true })
  } catch {
    // Idem.
  }
}

/**
 * Perkiraan ruang terpakai dan tersedia.
 *
 * Di web angkanya dari `navigator.storage.estimate()` dan menyangkut seluruh
 * origin — termasuk snapshot SQLite dan cache cover, bukan cuma unduhan. Itu
 * memang yang ingin diketahui orang yang bertanya "aplikasi ini makan berapa".
 * Di native belum ada padanannya yang murah, jadi yang dikembalikan `null` dan
 * UI menyembunyikan angkanya alih-alih menampilkan tebakan.
 */
export async function storageEstimate(): Promise<{ used: number; quota: number } | null> {
  if (native || typeof navigator.storage?.estimate !== 'function') return null
  const { usage, quota } = await navigator.storage.estimate()
  return { used: usage ?? 0, quota: quota ?? 0 }
}

/**
 * Meminta penyimpanan yang tidak dibuang browser waktu ruang menipis.
 *
 * Cuma berarti di web, dan browser boleh menolak tanpa alasan. Dipanggil sekali
 * saat unduhan pertama dimulai — meminta izin sebelum penggunanya menunjukkan
 * niat menyimpan apa pun cuma memunculkan dialog yang membingungkan.
 */
export async function requestPersistence(): Promise<boolean> {
  if (native || typeof navigator.storage?.persist !== 'function') return true
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
