import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RemoteSource } from '@mirai/extension-runtime'
import type { CategoryRow, EntryKind, EntryRow, ItemRow } from '@mirai/db'
import { decodeGenre } from '@mirai/db'
import {
  idOf,
  isStale,
  loadEntry,
  refreshEntry,
  rememberCatalogue,
  setBookmark,
  setEntrySeen,
  setFavorite,
  setSeen,
  setSeenUpTo,
} from '@/services/entry.service'
import { categoriesOf, listCategories, setEntryCategories } from '@/services/library.service'
import { challengeOf, type ChallengeInfo } from '@/services/challenge.service'
import { t } from '@/i18n'

/**
 * Halaman detail satu entri.
 *
 * Urutannya penting: baris dari SQLite dulu, jaringan menyusul. Membuka judul
 * yang pernah dibuka harus langsung memperlihatkan sinopsis dan daftar chapter
 * walau sedang offline — kegagalan refresh jadi pesan di atas daftar, bukan
 * pengganti halaman.
 */
export const useEntryStore = defineStore('entry', () => {
  const entry = ref<EntryRow | null>(null)
  const items = ref<ItemRow[]>([])
  const categories = ref<CategoryRow[]>([])
  const allCategories = ref<CategoryRow[]>([])

  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref<string | null>(null)
  const challenge = ref<ChallengeInfo | null>(null)
  /** Urutan daftar item; menurun (terbaru dulu) sesuai kebiasaan situs sumber. */
  const descending = ref(true)

  const genres = computed(() => decodeGenre(entry.value?.genre ?? null))
  const unread = computed(() => items.value.filter((item) => item.seen === 0).length)
  const sorted = computed(() => (descending.value ? items.value : [...items.value].reverse()))

  /** Item terlama yang belum dibaca — tujuan tombol Baca/Tonton di Fase 4-5. */
  const resume = computed<ItemRow | undefined>(() =>
    [...items.value].reverse().find((item) => item.seen === 0),
  )

  async function open(kind: EntryKind, sourceId: string, url: string, source?: RemoteSource) {
    loading.value = true
    error.value = null
    challenge.value = null

    try {
      const id = idOf(sourceId, url)
      let bundle = await loadEntry(id)

      if (!bundle) {
        if (!source) {
          throw new Error(t('errors.entryMissing'))
        }
        // Tautan langsung ke judul yang belum pernah dibuka: barisnya dibuat
        // dulu dengan url sebagai judul sementara, lalu `getDetails()` yang
        // mengisi sisanya beberapa saat kemudian.
        await rememberCatalogue(kind, sourceId, [{ url, title: url }])
        bundle = await loadEntry(id)
      }

      if (!bundle) throw new Error(t('errors.entryNotSaved'))

      entry.value = bundle.entry
      items.value = bundle.items
      categories.value = bundle.categories
      allCategories.value = await listCategories(kind)
    } catch (cause) {
      entry.value = null
      items.value = []
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }

    // Ambil dari jaringan hanya kalau memang belum lengkap; membuka ulang judul
    // yang sama tidak perlu menembak situs sumbernya lagi.
    if (source && entry.value && isStale(entry.value)) await refresh(source)
  }

  async function reload(): Promise<void> {
    const current = entry.value
    if (!current) return
    const bundle = await loadEntry(current.id)
    if (!bundle) return
    entry.value = bundle.entry
    items.value = bundle.items
    categories.value = bundle.categories
  }

  async function refresh(source: RemoteSource): Promise<void> {
    const current = entry.value
    if (!current || refreshing.value) return

    refreshing.value = true
    error.value = null
    challenge.value = null
    try {
      await refreshEntry(source, current)
      await reload()
    } catch (cause) {
      const blocked = challengeOf(cause)
      if (blocked) challenge.value = blocked
      else error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      refreshing.value = false
    }
  }

  async function toggleFavorite(source?: RemoteSource): Promise<void> {
    const current = entry.value
    if (!current) return
    await setFavorite(current, current.favorite === 0, source)
    await reload()
  }

  async function toggleSeen(item: ItemRow): Promise<void> {
    await setSeen(item, item.seen === 0)
    await reload()
  }

  async function markUpTo(item: ItemRow): Promise<void> {
    await setSeenUpTo(items.value, item)
    await reload()
  }

  async function markAll(seen: boolean): Promise<void> {
    const current = entry.value
    if (!current) return
    await setEntrySeen(current, seen)
    await reload()
  }

  async function toggleBookmark(item: ItemRow): Promise<void> {
    await setBookmark(item, item.bookmark === 0)
    await reload()
  }

  async function saveCategories(ids: string[]): Promise<void> {
    const current = entry.value
    if (!current) return
    await setEntryCategories(current.id, ids)
    categories.value = await categoriesOf(current.id)
  }

  function toggleOrder(): void {
    descending.value = !descending.value
  }

  return {
    entry,
    items,
    sorted,
    categories,
    allCategories,
    loading,
    refreshing,
    error,
    challenge,
    descending,
    genres,
    unread,
    resume,
    open,
    reload,
    refresh,
    toggleFavorite,
    toggleSeen,
    markUpTo,
    markAll,
    toggleBookmark,
    saveCategories,
    toggleOrder,
  }
})
