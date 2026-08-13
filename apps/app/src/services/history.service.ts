import type { HistoryEntry } from '@mirai/db'
import { repos } from './db.service'
import { settings } from './settings.service'

/**
 * Riwayat baca/tonton. Satu baris per item — yang ingin diketahui selalu
 * "kapan terakhir ini dibuka", bukan berapa kali.
 */

export function recentHistory(limit = 100): Promise<HistoryEntry[]> {
  return repos().history.recent(limit)
}

/**
 * Menghapus satu baris riwayat tidak mengubah tanda "sudah dibaca" pada
 * itemnya: yang dihapus adalah jejak, bukan kemajuan.
 */
export function removeHistory(itemId: string): Promise<void> {
  return repos().history.remove(itemId)
}

export function clearHistory(): Promise<void> {
  return repos().history.clear()
}

/**
 * Mencatat jejak "item ini baru saja dibuka" — kecuali incognito menyala.
 *
 * Gerbangnya duduk di sini, bukan di tiap pemanggil: riwayat ditulis dari
 * reader, pemutar, dan tombol "tandai sudah dibaca", dan satu pemanggil yang
 * lupa memeriksa berarti mode privatnya bocor tanpa ada yang menyadari.
 */
export function recordHistory(itemId: string, entryId: string, position: number): Promise<void> {
  if (settings.incognito) return Promise.resolve()
  return repos().history.record(itemId, entryId, position)
}
