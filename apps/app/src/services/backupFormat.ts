import type { DbSnapshot } from '@mirai/db'
import type { PreferenceSnapshot } from '@mirai/extension-runtime'
import type { InstalledRecord, RepoRecord } from './extensionStorage.service'

/**
 * Bentuk berkas backup, beserta pembacanya.
 *
 * Dipisah dari `backup.service.ts` karena tidak menyentuh database, berkas,
 * maupun `localStorage`: yang di sini cuma aturan tentang seperti apa berkas
 * yang sah, dan itu justru bagian yang paling perlu diuji. Berkas backup adalah
 * satu-satunya data di aplikasi ini yang datang dari luar dan dipercaya menulis
 * ke seluruh tabel sekaligus.
 */

export const BACKUP_FORMAT = 'mirai-backup'

/**
 * Versi **format**, bukan versi aplikasi.
 *
 * Naik hanya kalau berkas lama tidak lagi bisa dibaca apa adanya. Menambah
 * bidang baru yang boleh kosong tidak menaikkannya — itu yang membuat backup
 * dari versi lama tetap bisa dipulihkan setahun kemudian.
 */
export const BACKUP_VERSION = 1

export interface BackupExtensions {
  repos: RepoRecord[]
  installed: InstalledRecord[]
  /** Setelan per paket, dipetakan dari `pkg`. */
  prefs: Record<string, PreferenceSnapshot>
  showNsfw: boolean
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  /** Epoch milidetik saat berkas dibuat. */
  createdAt: number
  /** Versi aplikasi pembuatnya — untuk dibaca manusia, bukan untuk dicocokkan. */
  app: string
  db: DbSnapshot
  extensions: BackupExtensions
}

/** Angka yang ditampilkan sebelum dan sesudah pemulihan. */
export interface BackupSummary {
  entries: number
  categories: number
  items: number
  history: number
  settings: number
  extensions: number
}

export function summarize(file: BackupFile): BackupSummary {
  return {
    entries: file.db.entry.length,
    categories: file.db.category.length,
    items: file.db.item.length,
    history: file.db.history.length,
    settings: file.db.setting.length,
    extensions: file.extensions.installed.length,
  }
}

/**
 * Nama berkas bertanggal supaya beberapa backup bisa hidup berdampingan di satu
 * folder tanpa saling menimpa. Tanggalnya dioper, tidak diambil sendiri, supaya
 * fungsinya bisa diuji.
 */
export function backupFileName(at: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `mirai-backup-${stamp}.json`
}

/**
 * Sebab kegagalan pembacaan, bukan kalimatnya.
 *
 * Berkas dibaca di modul yang tidak tahu bahasa apa pun — kalimatnya disusun
 * pemanggil lewat `settings.backup.<code>`. Kalau kalimatnya dirakit di sini,
 * pesan error jadi satu-satunya bagian antarmuka yang tidak ikut berganti
 * bahasa.
 */
export class BackupError extends Error {
  constructor(
    readonly code: 'notJson' | 'notMirai' | 'tooNew',
    readonly params: Record<string, number> = {},
  ) {
    super(code)
    this.name = 'BackupError'
  }
}

/**
 * Membaca teks jadi `BackupFile`, atau melempar `BackupError` dengan sebabnya.
 *
 * Pembacaan yang **memaafkan bagian yang hilang** tapi **menolak berkas yang
 * salah**: tabel yang tidak ada dianggap kosong, karena backup dari versi lama
 * memang belum punya semuanya; tapi berkas yang bukan backup Mirai ditolak
 * sebelum satu baris pun tersentuh. Diam-diam memulihkan berkas asing berarti
 * menulis ke seluruh tabel dengan data yang bentuknya tidak diketahui.
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('notJson')
  }

  if (!isRecord(raw) || raw['format'] !== BACKUP_FORMAT) {
    throw new BackupError('notMirai')
  }

  const version = typeof raw['version'] === 'number' ? raw['version'] : 0
  if (version > BACKUP_VERSION) {
    throw new BackupError('tooNew', { version })
  }

  const db = isRecord(raw['db']) ? raw['db'] : {}
  const extensions = isRecord(raw['extensions']) ? raw['extensions'] : {}
  const prefs = isRecord(extensions['prefs']) ? extensions['prefs'] : {}

  return {
    format: BACKUP_FORMAT,
    version,
    createdAt: typeof raw['createdAt'] === 'number' ? raw['createdAt'] : 0,
    // Nilai data, bukan teks antarmuka: tidak diterjemahkan.
    app: typeof raw['app'] === 'string' ? raw['app'] : 'unknown',
    db: {
      entry: rows(db['entry']),
      category: rows(db['category']),
      entry_category: rows(db['entry_category']),
      item: rows(db['item']),
      history: rows(db['history']),
      setting: rows(db['setting']),
    },
    extensions: {
      repos: rows(extensions['repos']),
      installed: rows<InstalledRecord>(extensions['installed']).filter(
        // Saringan yang sama dengan `readInstalled()`: rekaman tanpa `entry.file`
        // tidak bisa dipasang ulang — tidak ada yang tahu berkas mana yang harus
        // diunduh — jadi dibuang di sini, sebelum sempat mengotori localStorage.
        (record) => typeof record?.pkg === 'string' && typeof record.entry?.file === 'string',
      ),
      prefs: prefs as Record<string, PreferenceSnapshot>,
      showNsfw: extensions['showNsfw'] === true,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Larik baris apa adanya. Isinya tidak diperiksa kolom demi kolom: skema SQLite
 * sudah menolak baris yang tidak muat, dan menyalin daftar kolom ke sini berarti
 * dua tempat yang harus diubah bersamaan setiap kali skemanya berubah.
 */
function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}
