import { Capacitor } from '@capacitor/core'
import type { RestoreCount } from '@mirai/db'
import { repos } from './db.service'
import {
  readInstalled,
  readPrefs,
  readRepos,
  readShowNsfw,
  writeInstalled,
  writePrefs,
  writeRepos,
  writeShowNsfw,
  type InstalledRecord,
} from './extensionStorage.service'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  parseBackup,
  type BackupFile,
} from './backupFormat'

/**
 * Membuat dan memulihkan berkas backup.
 *
 * Data Mirai tersebar di dua tempat, dan backup harus membawa keduanya supaya
 * perangkat baru benar-benar identik:
 *
 * - **SQLite** — library, kategori, progres, riwayat (lihat `BackupRepository`).
 * - **`localStorage`** — daftar repo extension, extension terpasang, dan
 *   setelan tiap paket. Tanpa bagian ini, library yang dipulihkan berisi entri
 *   yang menunjuk ke source yang tidak terpasang: judulnya tampil, tapi tidak
 *   ada satu pun chapter yang bisa diambil.
 *
 * Yang **tidak** ikut: `mirai.settings` (User-Agent — milik perangkat, dan UA
 * perangkat lain justru merusak cookie Cloudflare yang tersimpan di sana),
 * bundel kode extension (±275 KB per paket; diunduh ulang dari repo saat
 * dipasang), serta seluruh tabel `download`.
 */

const native = Capacitor.isNativePlatform()

/** Ditanam Vite dari `package.json`; berkasnya jadi bisa dilacak asalnya. */
const APP_VERSION = __APP_VERSION__

/** Hasil `applyBackup()`; extension-nya masih harus dipasang oleh store. */
export interface RestoreResult {
  counts: RestoreCount
  /**
   * Extension yang perlu diaktifkan ulang. Servis ini sengaja tidak
   * melakukannya sendiri: memasang extension berarti mengunduh bundel dari
   * jaringan dan menghidupkan worker — urusan `stores/extensions.ts`, dan servis
   * tidak boleh memanggil store (arahnya cuma satu, store → service).
   */
  extensions: InstalledRecord[]
}

export async function createBackup(): Promise<BackupFile> {
  const db = await repos().backup.dump()
  const installed = readInstalled()

  const prefs: BackupFile['extensions']['prefs'] = {}
  for (const record of installed) {
    const values = readPrefs(record.pkg)
    // Paket tanpa setelan yang pernah diubah tidak perlu menyumbang objek kosong.
    if (Object.keys(values).length > 0) prefs[record.pkg] = values
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    app: APP_VERSION,
    db,
    extensions: { repos: readRepos(), installed, prefs, showNsfw: readShowNsfw() },
  }
}

/**
 * Menyimpan backup ke berkas yang bisa dipindahkan pengguna, lalu mengembalikan
 * nama berkasnya.
 *
 * Dua jalur yang berbeda karena WebView Android tidak punya folder Unduhan yang
 * bisa ditulis tanpa izin: di native berkasnya ditulis ke direktori cache
 * aplikasi lalu diserahkan ke lembar "Bagikan" — pengguna yang memilih mau
 * disimpan ke Drive, dikirim ke diri sendiri, atau ditaruh di Files. Di web
 * cukup unduhan biasa.
 */
export async function exportBackup(now: Date = new Date()): Promise<string> {
  const file = await createBackup()
  const name = backupFileName(now)
  // Tanpa indentasi: berkas backup dibaca mesin, dan library besar bisa
  // membengkak berlipat kalau tiap baris diberi spasi.
  const text = JSON.stringify(file)

  if (native) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')

    // `Directory.Cache`, bukan `Data`: berkas ini cuma perlu hidup sampai
    // aplikasi tujuan selesai menyalinnya, dan sistem boleh membersihkannya
    // sendiri setelah itu.
    await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache })
    await Share.share({ title: name, files: [uri] })
    return name
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  // Dicabut setelah satu putaran event loop; mencabutnya seketika membatalkan
  // unduhan di sebagian browser sebelum sempat dimulai.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}

/** Membaca berkas pilihan pengguna. Melempar dengan pesan siap tampil. */
export async function readBackup(file: File): Promise<BackupFile> {
  return parseBackup(await file.text())
}

/**
 * Menuliskan isi backup ke perangkat ini.
 *
 * Database digabung lewat repository; bagian extension digabung di sini karena
 * yang menyimpannya `localStorage`, bukan SQL. Sama seperti database, tidak ada
 * yang dihapus: repo dan extension yang sudah ada di perangkat ini tetap
 * tinggal, yang bentrok dimenangkan berkas backup.
 */
export async function applyBackup(file: BackupFile): Promise<RestoreResult> {
  const counts = await repos().backup.restore(file.db)

  writeRepos(mergeBy(readRepos(), file.extensions.repos, (repo) => repo.url))

  const existing = readInstalled()
  const merged = mergeBy(existing, file.extensions.installed, (record) => record.pkg)
  writeInstalled(merged)

  for (const [pkg, values] of Object.entries(file.extensions.prefs)) {
    // Setelan digabung per kunci supaya setelan lokal yang tidak disebut backup
    // — misalnya domain alternatif yang baru dipilih di perangkat ini — tidak
    // ikut hilang.
    writePrefs(pkg, { ...readPrefs(pkg), ...values })
  }

  // Saklar NSFW cuma dinyalakan, tidak pernah dimatikan: backup dari perangkat
  // yang penggunanya belum pernah menyentuhnya tidak boleh menyembunyikan
  // extension yang sudah terpasang di sini.
  if (file.extensions.showNsfw) writeShowNsfw(true)

  const known = new Set(existing.map((record) => record.pkg))
  return { counts, extensions: merged.filter((record) => !known.has(record.pkg)) }
}

/**
 * Menggabungkan dua daftar berdasarkan kunci, dengan `incoming` yang menang.
 * Urutan `current` dipertahankan supaya daftar di layar tidak teracak setelah
 * restore; yang baru menyusul di belakang.
 */
function mergeBy<T>(current: T[], incoming: T[], key: (item: T) => string): T[] {
  const byKey = new Map(current.map((item) => [key(item), item]))
  for (const item of incoming) byKey.set(key(item), item)
  return [...byKey.values()]
}
