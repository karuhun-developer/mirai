<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowDownUp,
  BookOpen,
  FolderPlus,
  Heart,
  Play,
  RefreshCw,
  TriangleAlert,
} from '@lucide/vue'
import type { EntryKind, ItemRow as ItemRowType } from '@mirai/db'
import AppHeader from '@/components/layout/AppHeader.vue'
import ChallengeNotice from '@/components/common/ChallengeNotice.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import CategoryPicker from '@/components/entry/CategoryPicker.vue'
import ItemRow from '@/components/entry/ItemRow.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCover } from '@/composables/useCover'
import { playerLocation, readerLocation } from '@/router/links'
import { useEntryStore } from '@/stores/entry'
import { useExtensionsStore } from '@/stores/extensions'

const route = useRoute()
const router = useRouter()
const store = useEntryStore()
const extensions = useExtensionsStore()

const kind = computed<EntryKind>(() => (route.params['kind'] === 'anime' ? 'anime' : 'manga'))
const sourceId = computed(() => String(route.params['sourceId'] ?? ''))
const url = computed(() => String(route.params['url'] ?? ''))

const source = computed(() => extensions.byId(sourceId.value))
const { src, failed } = useCover(() => store.entry?.thumbnail_url ?? null)

const showCategories = ref(false)
const expanded = ref(false)

const statusLabel: Record<string, string> = {
  ongoing: 'Berjalan',
  completed: 'Tamat',
  hiatus: 'Hiatus',
  cancelled: 'Dibatalkan',
  unknown: 'Tidak diketahui',
}

const itemLabel = computed(() => (kind.value === 'anime' ? 'Episode' : 'Chapter'))

async function load(): Promise<void> {
  await extensions.ensureLoaded()
  await store.open(kind.value, sourceId.value, url.value, source.value)
}

/** Chapter dibuka di reader, episode di pemutar; keduanya sudah ada. */
async function open(item: ItemRowType): Promise<void> {
  await router.push(kind.value === 'anime' ? playerLocation(item.id) : readerLocation(item.id))
}

async function saveCategories(ids: string[]): Promise<void> {
  await store.saveCategories(ids)
  showCategories.value = false
}

onMounted(load)
// Berpindah entri lewat tautan di halaman ini tidak me-mount ulang komponennya.
watch([kind, sourceId, url], load)
</script>

<template>
  <AppHeader :title="store.entry?.title ?? 'Memuat…'" />

  <!-- Kalau entrinya sendiri gagal dibuka, yang tampil EmptyState di bawah;
       baris merah ini khusus kegagalan menyegarkan entri yang sudah tampil. -->
  <p
    v-if="store.error && store.entry"
    class="mx-4 mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
  >
    {{ store.error }}
  </p>

  <ChallengeNotice
    v-if="store.challenge"
    :challenge="store.challenge"
    :source-name="source?.name ?? 'Sumber ini'"
  />

  <template v-if="store.entry">
    <section class="flex gap-4 px-4 py-4">
      <div class="w-28 shrink-0 overflow-hidden rounded-lg bg-surface md:w-40">
        <img
          v-if="src && !failed"
          :src="src"
          :alt="store.entry.title"
          class="aspect-2/3 size-full object-cover"
        />
        <div
          v-else
          class="grid aspect-2/3 place-items-center p-2 text-center text-xs text-muted-foreground"
        >
          {{ store.entry.title }}
        </div>
      </div>

      <div class="min-w-0 flex-1 space-y-2">
        <h2 class="text-lg font-semibold leading-tight">{{ store.entry.title }}</h2>

        <p class="text-sm text-muted-foreground">
          <span v-if="store.entry.author">{{ store.entry.author }}</span>
          <span v-if="store.entry.author && store.entry.status"> · </span>
          <span v-if="store.entry.status">
            {{ statusLabel[store.entry.status] ?? store.entry.status }}
          </span>
        </p>

        <p class="text-xs text-muted-foreground">
          {{ source?.name ?? sourceId }} · {{ store.items.length }} {{ itemLabel.toLowerCase() }} ·
          {{ store.unread }} belum dibaca
        </p>

        <div class="flex flex-wrap gap-2 pt-1">
          <Button
            :variant="store.entry.favorite === 1 ? 'secondary' : 'default'"
            size="sm"
            @click="store.toggleFavorite(source)"
          >
            <Heart :class="store.entry.favorite === 1 ? 'fill-current' : ''" />
            {{ store.entry.favorite === 1 ? 'Di library' : 'Tambah ke library' }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            :disabled="!source || store.refreshing"
            @click="source && store.refresh(source)"
          >
            <RefreshCw :class="store.refreshing ? 'animate-spin' : ''" />
            {{ store.refreshing ? 'Menyegarkan…' : 'Segarkan' }}
          </Button>

          <Button
            v-if="store.entry.favorite === 1"
            variant="outline"
            size="sm"
            @click="showCategories = !showCategories"
          >
            <FolderPlus />
            Kategori
          </Button>
        </div>

        <Button
          v-if="store.resume"
          size="sm"
          variant="ghost"
          :title="`Lanjut ${kind === 'anime' ? 'tonton' : 'baca'} ${store.resume.name}`"
          @click="store.resume && open(store.resume)"
        >
          <component :is="kind === 'anime' ? Play : BookOpen" />
          Lanjut: {{ store.resume.name }}
        </Button>
      </div>
    </section>

    <CategoryPicker
      v-if="showCategories"
      class="mx-4"
      :all="store.allCategories"
      :selected="store.categories"
      @save="saveCategories($event)"
      @close="showCategories = false"
    />

    <div v-if="store.categories.length > 0" class="flex flex-wrap gap-1 px-4 pb-2">
      <Badge v-for="category in store.categories" :key="category.id" variant="secondary">
        {{ category.name }}
      </Badge>
    </div>

    <section v-if="store.entry.description" class="px-4 pb-4">
      <p
        class="text-sm leading-relaxed text-muted-foreground"
        :class="expanded ? '' : 'line-clamp-3'"
      >
        {{ store.entry.description }}
      </p>
      <button
        type="button"
        class="mt-1 text-xs font-medium text-primary"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Ringkas' : 'Selengkapnya' }}
      </button>
    </section>

    <div v-if="store.genres.length > 0" class="flex flex-wrap gap-1 px-4 pb-4">
      <Badge v-for="genre in store.genres" :key="genre" variant="outline">{{ genre }}</Badge>
    </div>

    <div class="flex items-center gap-2 border-t border-border px-4 py-2">
      <p class="flex-1 text-sm font-medium">{{ itemLabel }}</p>
      <Button variant="ghost" size="sm" @click="store.markAll(true)">Tandai semua</Button>
      <Button variant="ghost" size="icon-sm" aria-label="Balik urutan" @click="store.toggleOrder()">
        <ArrowDownUp class="size-4" />
      </Button>
    </div>

    <ul v-if="store.sorted.length > 0" class="divide-y divide-border pb-24 md:pb-8">
      <ItemRow
        v-for="item in store.sorted"
        :key="item.id"
        :item="item"
        openable
        @open="open(item)"
        @toggle-seen="store.toggleSeen(item)"
        @toggle-bookmark="store.toggleBookmark(item)"
        @mark-up-to="store.markUpTo(item)"
      />
    </ul>

    <p v-else-if="!store.refreshing" class="px-4 py-10 text-center text-sm text-muted-foreground">
      Belum ada {{ itemLabel.toLowerCase() }} yang tersimpan.
    </p>
  </template>

  <EmptyState
    v-else-if="!store.loading && store.error"
    :icon="TriangleAlert"
    title="Entri tidak bisa dibuka"
    description="Judul ini belum tersimpan di perangkat, dan extension sumbernya sedang tidak tersedia."
  />
</template>
