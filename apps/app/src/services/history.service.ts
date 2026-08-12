import type { HistoryEntry } from '@mirai/db'
import { repos } from './db.service'

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

export function recordHistory(itemId: string, entryId: string, position: number): Promise<void> {
  return repos().history.record(itemId, entryId, position)
}
