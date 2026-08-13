/**
 * Aturan "ruangnya masih cukup atau tidak".
 *
 * Satu episode anime 24 menit berkisar 150–500 MB — dua kelas berbeda dari
 * chapter manga yang cuma beberapa megabita. Karena itu ruang penyimpanan mulai
 * jadi urusan aplikasi di fase unduh anime: yang paling buruk bukan penolakan di
 * depan, melainkan episode separuh jadi yang memakan sisa ruang lalu tetap tidak
 * bisa diputar.
 *
 * Murni dan tanpa dependensi supaya ambangnya bisa diuji tanpa browser.
 */

export type StorageLevel = 'ok' | 'low' | 'full'

export interface StorageStatus {
  level: StorageLevel
  /** Sisa ruang dalam byte. */
  free: number
  /**
   * Kunci terjemahan peringatannya; `null` kalau ruangnya masih lega.
   *
   * Kunci, bukan kalimat jadi: modul ini sengaja bebas dependensi supaya
   * ambangnya bisa diuji tanpa browser — dan memanggil i18n di sini berarti
   * menyeret seluruh katalog ke dalam unit test aritmetika.
   */
  messageKey: string | null
}

/**
 * Ambangnya dua-duanya: persentase **dan** angka mutlak, diambil yang lebih
 * besar. Kuota browser bisa ratusan gigabita (10% berarti puluhan GB, terlalu
 * cerewet) atau cuma beberapa ratus megabita di perangkat penuh (10% berarti
 * tidak pernah memperingatkan apa pun sampai benar-benar mentok).
 */
const LOW_BYTES = 1024 * 1024 * 1024
const FULL_BYTES = 200 * 1024 * 1024
const LOW_RATIO = 0.1
const FULL_RATIO = 0.03

export function storageStatus(estimate: { used: number; quota: number } | null): StorageStatus {
  // Kuota tidak diketahui (native, atau browser yang tidak mengabarkannya)
  // diperlakukan sebagai lega: menakut-nakuti tanpa angka lebih buruk daripada
  // diam, dan kegagalan menulis nanti tetap punya pesannya sendiri.
  if (!estimate || estimate.quota <= 0)
    return { level: 'ok', free: Number.POSITIVE_INFINITY, messageKey: null }

  const free = Math.max(estimate.quota - estimate.used, 0)

  if (free <= Math.max(FULL_BYTES, estimate.quota * FULL_RATIO)) {
    return {
      level: 'full',
      free,
      messageKey: 'storage.full',
    }
  }

  if (free <= Math.max(LOW_BYTES, estimate.quota * LOW_RATIO)) {
    return {
      level: 'low',
      free,
      messageKey: 'storage.low',
    }
  }

  return { level: 'ok', free, messageKey: null }
}

/** Ukuran dalam satuan yang dibaca manusia; angka byte mentah tidak berarti apa-apa. */
export function humanBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`
}
