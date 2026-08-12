<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { TriangleAlert } from '@lucide/vue'
import type { SEntry } from '@mirai/extension-api'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import EntryGrid from '@/components/entry/EntryGrid.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useExtensionsStore } from '@/stores/extensions'

type Mode = 'popular' | 'latest' | 'search'

const route = useRoute()
const store = useExtensionsStore()

const sourceId = computed(() => String(route.params['sourceId'] ?? ''))
const source = computed(() => store.byId(sourceId.value))

const entries = ref<SEntry[]>([])
const page = ref(1)
const hasNextPage = ref(false)
const mode = ref<Mode>('popular')
const searchTerm = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

// Halaman yang datang terlambat setelah user mengganti mode akan menimpa hasil
// yang benar; token ini membuat respons basi dibuang, bukan dirender.
let requestToken = 0

async function fetchPage(next: boolean): Promise<void> {
  const current = source.value
  if (!current || busy.value) return

  const token = ++requestToken
  busy.value = true
  error.value = null
  const targetPage = next ? page.value + 1 : 1

  try {
    const result =
      mode.value === 'search'
        ? await current.getSearch(targetPage, searchTerm.value)
        : mode.value === 'latest'
          ? await current.getLatest(targetPage)
          : await current.getPopular(targetPage)

    if (token !== requestToken) return

    entries.value = next ? [...entries.value, ...result.entries] : result.entries
    page.value = targetPage
    hasNextPage.value = result.hasNextPage
  } catch (cause) {
    if (token !== requestToken) return
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    if (token === requestToken) busy.value = false
  }
}

function switchMode(next: Mode): void {
  mode.value = next
  void fetchPage(false)
}

function submitSearch(): void {
  mode.value = searchTerm.value.trim() ? 'search' : 'popular'
  void fetchPage(false)
}

onMounted(async () => {
  await store.ensureLoaded()
  await fetchPage(false)
})

// Berpindah source lewat tombol kembali tidak me-mount ulang komponen.
watch(sourceId, () => {
  entries.value = []
  mode.value = 'popular'
  searchTerm.value = ''
  void fetchPage(false)
})

const tabs: { key: Mode; label: string }[] = [
  { key: 'popular', label: 'Populer' },
  { key: 'latest', label: 'Terbaru' },
]
</script>

<template>
  <AppHeader :title="source?.name ?? 'Sumber'">
    <template #tabs>
      <div class="flex items-center gap-2 px-4 pb-3">
        <div class="flex gap-1">
          <Button
            v-for="tab in tabs"
            :key="tab.key"
            :variant="mode === tab.key ? 'secondary' : 'ghost'"
            size="sm"
            :disabled="tab.key === 'latest' && source?.info.supportsLatest === false"
            @click="switchMode(tab.key)"
          >
            {{ tab.label }}
          </Button>
        </div>
        <form class="flex-1" @submit.prevent="submitSearch">
          <Input v-model="searchTerm" placeholder="Cari judul…" aria-label="Cari judul" />
        </form>
      </div>
    </template>
  </AppHeader>

  <EmptyState
    v-if="!source && store.state === 'ready'"
    :icon="TriangleAlert"
    title="Sumber tidak ditemukan"
    :description="`Extension untuk ${sourceId} tidak terpasang.`"
  />

  <template v-else>
    <p v-if="error" class="mx-4 mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      {{ error }}
    </p>

    <EntryGrid v-if="entries.length > 0" :entries="entries" />

    <p v-if="busy" class="px-4 py-6 text-center text-sm text-muted-foreground">Memuat…</p>

    <p
      v-else-if="entries.length === 0 && !error"
      class="px-4 py-10 text-center text-sm text-muted-foreground"
    >
      Tidak ada hasil.
    </p>

    <div v-if="hasNextPage && !busy" class="flex justify-center px-4 pb-24 md:pb-8">
      <Button variant="outline" @click="fetchPage(true)">Muat lebih banyak</Button>
    </div>
  </template>
</template>
