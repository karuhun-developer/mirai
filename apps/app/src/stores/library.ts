import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CategoryRow, EntryKind, LibraryEntry } from '@mirai/db'
import {
  ALL_CATEGORIES,
  NO_CATEGORY,
  categoryCounts,
  createCategory,
  defaultPrefs,
  listCategories,
  listLibrary,
  readActiveCategory,
  readPrefs,
  removeCategory,
  renameCategory,
  writeActiveCategory,
  writePrefs,
  type LibraryPrefs,
} from '@/services/library.service'

/** Satu tab di atas grid. `id` memakai sentinel `all`/`none`. */
export interface CategoryTab {
  id: string
  name: string
  count: number
}

/**
 * Keadaan halaman Library.
 *
 * Satu store melayani tab Anime dan Manga bergantian, bukan satu store per
 * jenis: yang ditampilkan selalu satu jenis saja, dan menyimpan keduanya
 * sekaligus cuma menambah keadaan yang harus dijaga tetap sinkron.
 *
 * Pencarian tidak di-debounce. Query-nya `LIKE` di SQLite lokal atas puluhan
 * sampai ribuan baris — menunda hasilnya justru terasa lebih lambat daripada
 * mengetik dengan grid yang menyusut seketika.
 */
export const useLibraryStore = defineStore('library', () => {
  const kind = ref<EntryKind>('manga')
  const entries = ref<LibraryEntry[]>([])
  const categories = ref<CategoryRow[]>([])
  const counts = ref<Record<string, number>>({})
  const uncategorized = ref(0)
  const totalFavorites = ref(0)

  const selection = ref<string>(ALL_CATEGORIES)
  const search = ref('')
  const prefs = ref<LibraryPrefs>({ ...defaultPrefs })

  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Tab hanya muncul kalau kategori memang dipakai. Library tanpa kategori
   * tidak perlu barisan tab berisi satu tombol yang tidak melakukan apa-apa.
   */
  const tabs = computed<CategoryTab[]>(() => {
    if (categories.value.length === 0) return []
    const rows: CategoryTab[] = [
      { id: ALL_CATEGORIES, name: 'Semua', count: totalFavorites.value },
      ...categories.value.map((category) => ({
        id: category.id,
        name: category.name,
        count: counts.value[category.id] ?? 0,
      })),
    ]
    if (uncategorized.value > 0) {
      rows.push({ id: NO_CATEGORY, name: 'Tanpa kategori', count: uncategorized.value })
    }
    return rows
  })

  const filterActive = computed(() => prefs.value.unreadOnly || prefs.value.downloadedOnly)

  async function open(next: EntryKind): Promise<void> {
    if (kind.value !== next) {
      kind.value = next
      entries.value = []
      search.value = ''
    }
    prefs.value = await readPrefs()
    selection.value = await readActiveCategory(next)
    await reload()
  }

  async function reload(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      categories.value = await listCategories(kind.value)
      counts.value = await categoryCounts(kind.value)

      // Angka tab dihitung dari query tanpa filter, bukan dari `entries`:
      // menyaring "belum dibaca" tidak boleh membuat jumlah di tab ikut turun.
      const all = await listLibrary(kind.value, ALL_CATEGORIES, '', defaultPrefs)
      totalFavorites.value = all.length
      uncategorized.value = (await listLibrary(kind.value, NO_CATEGORY, '', defaultPrefs)).length

      // Kategori yang sedang dibuka bisa saja baru dihapus dari perangkat lain
      // atau di tab lain; kalau dibiarkan, grid tampil kosong tanpa sebab.
      if (
        selection.value !== ALL_CATEGORIES &&
        selection.value !== NO_CATEGORY &&
        !categories.value.some((category) => category.id === selection.value)
      ) {
        selection.value = ALL_CATEGORIES
      }

      entries.value = await listLibrary(kind.value, selection.value, search.value, prefs.value)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  async function setSelection(id: string): Promise<void> {
    selection.value = id
    await writeActiveCategory(kind.value, id)
    await reload()
  }

  async function setSearch(value: string): Promise<void> {
    search.value = value
    await reload()
  }

  async function setPrefs(patch: Partial<LibraryPrefs>): Promise<void> {
    prefs.value = { ...prefs.value, ...patch }
    await writePrefs(prefs.value)
    await reload()
  }

  async function addCategory(name: string): Promise<void> {
    if (!name.trim()) return
    await createCategory(name, kind.value)
    await reload()
  }

  async function editCategory(id: string, name: string): Promise<void> {
    if (!name.trim()) return
    await renameCategory(id, name)
    await reload()
  }

  async function dropCategory(id: string): Promise<void> {
    await removeCategory(id)
    if (selection.value === id) selection.value = ALL_CATEGORIES
    await reload()
  }

  return {
    kind,
    entries,
    categories,
    counts,
    totalFavorites,
    selection,
    search,
    prefs,
    loading,
    error,
    tabs,
    filterActive,
    open,
    reload,
    setSelection,
    setSearch,
    setPrefs,
    addCategory,
    editCategory,
    dropCategory,
  }
})
