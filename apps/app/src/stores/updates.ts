import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { EntryKind, ItemWithEntry } from '@mirai/db'
import {
  listUpdates,
  refreshLibrary,
  type RefreshProgress,
  type RefreshReport,
  type SourceLookup,
} from '@/services/updates.service'
import { setSeen } from '@/services/entry.service'

/**
 * Halaman Updates.
 *
 * Daftarnya selalu dibaca dari database — hasil penyegaran sebelumnya tetap
 * tampil saat offline. Penyegarannya sendiri berjalan berurutan dan bisa
 * dibatalkan; tanpa itu, menekan Muat Ulang di library berisi ratusan judul
 * berarti menunggu tanpa kabar dan tanpa jalan keluar.
 */
export const useUpdatesStore = defineStore('updates', () => {
  const items = ref<ItemWithEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const progress = ref<RefreshProgress | null>(null)
  const report = ref<RefreshReport | null>(null)
  let cancelled = false

  const running = computed(() => progress.value !== null)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      items.value = await listUpdates()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  async function refresh(resolve: SourceLookup, kind?: EntryKind): Promise<void> {
    if (running.value) return
    cancelled = false
    report.value = null
    progress.value = { done: 0, total: 0, title: '' }

    try {
      report.value = await refreshLibrary(resolve, {
        ...(kind ? { kind } : {}),
        onProgress: (value) => {
          progress.value = value
        },
        shouldContinue: () => !cancelled,
      })
      await load()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      progress.value = null
    }
  }

  function cancel(): void {
    cancelled = true
  }

  /** Menandai satu update sudah dibaca langsung dari daftarnya. */
  async function markSeen(update: ItemWithEntry, seen: boolean): Promise<void> {
    await setSeen(update, seen)
    items.value = items.value.map((item) =>
      item.id === update.id ? { ...item, seen: seen ? 1 : 0 } : item,
    )
  }

  return { items, loading, error, progress, report, running, load, refresh, cancel, markSeen }
})
