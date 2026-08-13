<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { TriangleAlert } from '@lucide/vue'
import type { SEntry } from '@mirai/extension-api'
import AppHeader from '@/components/layout/AppHeader.vue'
import ChallengeNotice from '@/components/common/ChallengeNotice.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import EntryGrid from '@/components/entry/EntryGrid.vue'
import { fromSource } from '@/components/entry/grid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useExtensionsStore } from '@/stores/extensions'
import { challengeOf, type ChallengeInfo } from '@/services/challenge.service'
import { favoriteIds, idOf, rememberCatalogue } from '@/services/entry.service'

type Mode = 'popular' | 'latest' | 'search'

const { t } = useI18n()
const route = useRoute()
const store = useExtensionsStore()

const sourceId = computed(() => String(route.params['sourceId'] ?? ''))
const source = computed(() => store.byId(sourceId.value))

const entries = ref<SEntry[]>([])
/** Id entri yang ada di library; dipakai menandai kartu yang sudah difavoritkan. */
const favorites = ref<Set<string>>(new Set())
const page = ref(1)
const hasNextPage = ref(false)
const mode = ref<Mode>('popular')
const searchTerm = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
// Tantangan Cloudflare bukan error biasa: yang diminta bukan "coba lagi",
// melainkan tindakan manusia. Dipisah supaya UI-nya juga berbeda.
const challenge = ref<ChallengeInfo | null>(null)

// Halaman yang datang terlambat setelah user mengganti mode akan menimpa hasil
// yang benar; token ini membuat respons basi dibuang, bukan dirender.
let requestToken = 0

async function fetchPage(next: boolean): Promise<void> {
  const current = source.value
  if (!current || busy.value) return

  const token = ++requestToken
  busy.value = true
  error.value = null
  challenge.value = null
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

    // Hasil katalog ikut disimpan supaya membuka detailnya nanti — termasuk
    // saat jaringan sudah mati — tetap menemukan barisnya. Entri yang cuma
    // dilihat sekilas dibuang lagi oleh `pruneOrphans()`.
    await rememberCatalogue(current.kind, current.id, result.entries)
    favorites.value = await favoriteIds(entries.value.map((entry) => idOf(current.id, entry.url)))
  } catch (cause) {
    if (token !== requestToken) return
    const blocked = challengeOf(cause)
    if (blocked) challenge.value = blocked
    else error.value = cause instanceof Error ? cause.message : String(cause)
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

const cards = computed(() =>
  entries.value.map((entry) => {
    const current = source.value
    if (!current) return fromSource('manga', sourceId.value, entry)
    return {
      ...fromSource(current.kind, current.id, entry),
      favorite: favorites.value.has(idOf(current.id, entry.url)),
    }
  }),
)

const tabs: { key: Mode; labelKey: string }[] = [
  { key: 'popular', labelKey: 'browse.popular' },
  { key: 'latest', labelKey: 'browse.latest' },
]
</script>

<template>
  <AppHeader :title="source?.name ?? t('browse.sourceFallback')">
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
            {{ t(tab.labelKey) }}
          </Button>
        </div>
        <form class="flex-1" @submit.prevent="submitSearch">
          <Input
            v-model="searchTerm"
            :placeholder="t('browse.searchPlaceholder')"
            :aria-label="t('browse.searchPlaceholder')"
          />
        </form>
      </div>
    </template>
  </AppHeader>

  <EmptyState
    v-if="!source && store.state === 'ready'"
    :icon="TriangleAlert"
    :title="t('browse.notFoundTitle')"
    :description="t('browse.notFoundDescription', { id: sourceId })"
  />

  <template v-else>
    <ChallengeNotice
      v-if="challenge"
      :challenge="challenge"
      :source-name="source?.name ?? t('browse.thisSource')"
      @solved="fetchPage(false)"
    />

    <p v-if="error" class="mx-4 mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      {{ error }}
    </p>

    <EntryGrid v-if="cards.length > 0" :entries="cards" />

    <p v-if="busy" class="px-4 py-6 text-center text-sm text-muted-foreground">
      {{ t('common.loading') }}
    </p>

    <p
      v-else-if="entries.length === 0 && !error && !challenge"
      class="px-4 py-10 text-center text-sm text-muted-foreground"
    >
      {{ t('browse.noResults') }}
    </p>

    <div v-if="hasNextPage && !busy" class="flex justify-center px-4 pb-24 md:pb-8">
      <Button variant="outline" @click="fetchPage(true)">{{ t('browse.loadMore') }}</Button>
    </div>
  </template>
</template>
