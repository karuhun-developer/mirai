import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { HistoryEntry } from '@mirai/db'
import { clearHistory, recentHistory, removeHistory } from '@/services/history.service'

/** Riwayat baca/tonton — seluruhnya lokal, jadi tetap utuh saat offline. */
export const useHistoryStore = defineStore('history', () => {
  const items = ref<HistoryEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      items.value = await recentHistory()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  async function remove(itemId: string): Promise<void> {
    await removeHistory(itemId)
    items.value = items.value.filter((item) => item.item_id !== itemId)
  }

  async function clear(): Promise<void> {
    await clearHistory()
    items.value = []
  }

  return { items, loading, error, load, remove, clear }
})
