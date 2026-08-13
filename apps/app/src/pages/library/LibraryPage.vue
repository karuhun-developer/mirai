<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, RouterLink } from 'vue-router'
import { Library, SearchX } from '@lucide/vue'
import type { EntryKind } from '@mirai/db'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import EntryGrid from '@/components/entry/EntryGrid.vue'
import { fromLibrary } from '@/components/entry/grid'
import CategoryTabs from '@/components/library/CategoryTabs.vue'
import LibraryFilters from '@/components/library/LibraryFilters.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLibraryStore } from '@/stores/library'
import { useUpdatesStore } from '@/stores/updates'
import { useExtensionsStore } from '@/stores/extensions'

const { t } = useI18n()
const route = useRoute()
const library = useLibraryStore()
const updates = useUpdatesStore()
const extensions = useExtensionsStore()

/**
 * Satu halaman melayani `/library/anime` dan `/library/manga`. Isinya identik
 * kecuali jenis entri yang ditampilkan, jadi memisahnya jadi dua komponen cuma
 * menggandakan kode header, tab, dan grid.
 */
const kind = computed<EntryKind>(() => (route.params['kind'] === 'anime' ? 'anime' : 'manga'))
const title = computed(() => (kind.value === 'anime' ? t('common.anime') : t('common.manga')))

const showSearch = ref(false)
const showFilters = ref(false)

const cards = computed(() => library.entries.map(fromLibrary))
const empty = computed(() => !library.loading && cards.value.length === 0)
/** Kosong karena benar-benar belum ada isinya, bukan karena tersaring. */
const untouched = computed(
  () => empty.value && !library.search && !library.filterActive && library.totalFavorites === 0,
)

onMounted(() => {
  void library.open(kind.value)
  void extensions.ensureLoaded()
})

watch(kind, (next) => {
  showSearch.value = false
  void library.open(next)
})

function toggleSearch(): void {
  showSearch.value = !showSearch.value
  if (!showSearch.value && library.search) void library.setSearch('')
}

/**
 * Muat ulang di Library menyegarkan judul di library ini saja — bukan seluruh
 * koleksi. Yang menekan tombol ini sedang melihat satu jenis, dan menunggu
 * ratusan judul dari jenis lain ikut diperiksa tidak ada gunanya.
 */
async function refresh(): Promise<void> {
  await updates.refresh((sourceId) => extensions.byId(sourceId), kind.value)
  await library.reload()
}
</script>

<template>
  <AppHeader
    :title="title"
    show-search
    show-filter
    show-refresh
    @search="toggleSearch"
    @filter="showFilters = !showFilters"
    @refresh="refresh"
  >
    <template #tabs>
      <div v-if="showSearch" class="px-4 pb-3">
        <Input
          :model-value="library.search"
          :placeholder="t('library.searchPlaceholder')"
          :aria-label="t('library.searchLabel')"
          @update:model-value="library.setSearch(String($event))"
        />
      </div>

      <CategoryTabs
        v-if="library.tabs.length > 0"
        :tabs="library.tabs"
        :active="library.selection"
        @select="library.setSelection($event)"
      />
    </template>
  </AppHeader>

  <LibraryFilters
    v-if="showFilters"
    :prefs="library.prefs"
    :categories="library.categories"
    @update="library.setPrefs($event)"
    @add-category="library.addCategory($event)"
    @drop-category="library.dropCategory($event)"
  />

  <div v-if="updates.progress" class="px-4 py-2 text-xs text-muted-foreground">
    {{ t('library.refreshing', updates.progress) }}
    <Button variant="ghost" size="sm" class="ml-2" @click="updates.cancel()">
      {{ t('common.cancel') }}
    </Button>
  </div>

  <p
    v-if="library.error"
    class="mx-4 mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
  >
    {{ library.error }}
  </p>

  <EntryGrid v-if="cards.length > 0" :entries="cards" />

  <EmptyState
    v-else-if="untouched"
    :icon="Library"
    :title="t('library.emptyTitle', { kind: title })"
    :description="t('library.emptyDescription')"
  >
    <Button as-child>
      <RouterLink to="/browse">{{ t('library.browse') }}</RouterLink>
    </Button>
  </EmptyState>

  <EmptyState
    v-else-if="empty"
    :icon="SearchX"
    :title="t('library.noMatchTitle')"
    :description="t('library.noMatchDescription')"
  />
</template>
