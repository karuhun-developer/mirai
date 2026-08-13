<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowDownUp,
  BookOpen,
  Download,
  FolderPlus,
  Heart,
  Play,
  RefreshCw,
  TriangleAlert,
  Trash2,
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
import { useDownloadsStore } from '@/stores/downloads'
import { useEntryStore } from '@/stores/entry'
import { useExtensionsStore } from '@/stores/extensions'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useEntryStore()
const extensions = useExtensionsStore()
const downloads = useDownloadsStore()

const kind = computed<EntryKind>(() => (route.params['kind'] === 'anime' ? 'anime' : 'manga'))
const sourceId = computed(() => String(route.params['sourceId'] ?? ''))
const url = computed(() => String(route.params['url'] ?? ''))

const source = computed(() => extensions.byId(sourceId.value))
const { src, failed } = useCover(() => store.entry?.thumbnail_url ?? null)

const showCategories = ref(false)
const expanded = ref(false)

/**
 * Status dari extension datang sebagai kata kunci tetap (`ongoing`, `hiatus`, …),
 * jadi bisa diterjemahkan. Nilai di luar daftar ini ditampilkan apa adanya —
 * itu istilah situs sumbernya, bukan istilah Mirai.
 */
const STATUS_KEYS: Record<string, string> = {
  ongoing: 'entry.statusOngoing',
  completed: 'entry.statusCompleted',
  hiatus: 'entry.statusHiatus',
  cancelled: 'entry.statusCancelled',
  unknown: 'entry.statusUnknown',
}

function statusLabel(status: string): string {
  const key = STATUS_KEYS[status]
  return key ? t(key) : status
}

const itemLabel = computed(() => (kind.value === 'anime' ? t('entry.episode') : t('entry.chapter')))
const itemWord = computed(() =>
  kind.value === 'anime' ? t('entry.unitEpisode') : t('entry.unitChapter'),
)

const pendingItems = computed(() =>
  store.items.filter((item) => item.seen === 0 && item.downloaded === 0),
)
const downloadedCount = computed(() => store.items.filter((item) => item.downloaded === 1).length)

async function removeOne(item: ItemRowType): Promise<void> {
  if (store.entry) await downloads.remove(store.entry, item)
  await store.reload()
}

async function removeAll(): Promise<void> {
  if (store.entry) await downloads.removeEntry(store.entry)
  await store.reload()
}

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

/**
 * Tanda "tersimpan" ada di baris `item`, sementara yang berubah waktu unduhan
 * selesai adalah baris `download`. Daftar di halaman ini dimuat sekali, jadi
 * tanpa pengamat ini centangnya baru muncul setelah halaman dibuka ulang.
 */
watch(
  () => downloads.jobs.filter((job) => job.state === 'done').length,
  () => void store.reload(),
)
</script>

<template>
  <AppHeader :title="store.entry?.title ?? t('common.loading')" />

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
    :source-name="source?.name ?? t('browse.thisSource')"
    @solved="load()"
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
            {{ statusLabel(store.entry.status) }}
          </span>
        </p>

        <p class="text-xs text-muted-foreground">
          {{
            t('entry.meta', {
              source: source?.name ?? sourceId,
              count: store.items.length,
              unit: itemWord,
              unread: store.unread,
            })
          }}
        </p>

        <div class="flex flex-wrap gap-2 pt-1">
          <Button
            :variant="store.entry.favorite === 1 ? 'secondary' : 'default'"
            size="sm"
            @click="store.toggleFavorite(source)"
          >
            <Heart :class="store.entry.favorite === 1 ? 'fill-current' : ''" />
            {{ store.entry.favorite === 1 ? t('entry.inLibrary') : t('entry.addToLibrary') }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            :disabled="!source || store.refreshing"
            @click="source && store.refresh(source)"
          >
            <RefreshCw :class="store.refreshing ? 'animate-spin' : ''" />
            {{ store.refreshing ? t('entry.refreshing') : t('entry.refresh') }}
          </Button>

          <Button
            v-if="store.entry.favorite === 1"
            variant="outline"
            size="sm"
            @click="showCategories = !showCategories"
          >
            <FolderPlus />
            {{ t('entry.categories') }}
          </Button>
        </div>

        <Button
          v-if="store.resume"
          size="sm"
          variant="ghost"
          :title="
            kind === 'anime'
              ? t('entry.resumeWatch', { name: store.resume.name })
              : t('entry.resumeRead', { name: store.resume.name })
          "
          @click="store.resume && open(store.resume)"
        >
          <component :is="kind === 'anime' ? Play : BookOpen" />
          {{ t('entry.resume', { name: store.resume.name }) }}
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
        {{ expanded ? t('entry.collapse') : t('entry.expand') }}
      </button>
    </section>

    <div v-if="store.genres.length > 0" class="flex flex-wrap gap-1 px-4 pb-4">
      <Badge v-for="genre in store.genres" :key="genre" variant="outline">{{ genre }}</Badge>
    </div>

    <div class="flex items-center gap-2 border-t border-border px-4 py-2">
      <p class="flex-1 text-sm font-medium">{{ itemLabel }}</p>

      <Button
        v-if="pendingItems.length > 0"
        variant="ghost"
        size="sm"
        :title="
          kind === 'anime'
            ? t('entry.downloadPendingWatch', { count: pendingItems.length })
            : t('entry.downloadPendingRead', { count: pendingItems.length })
        "
        @click="downloads.download(pendingItems)"
      >
        <Download class="size-4" />
        {{ t('entry.download', { count: pendingItems.length }) }}
      </Button>

      <Button
        v-if="downloadedCount > 0"
        variant="ghost"
        size="icon-sm"
        :aria-label="t('entry.removeDownloaded', { count: downloadedCount, unit: itemWord })"
        :title="t('entry.removeDownloaded', { count: downloadedCount, unit: itemWord })"
        @click="removeAll()"
      >
        <Trash2 class="size-4" />
      </Button>

      <Button variant="ghost" size="sm" @click="store.markAll(true)">
        {{ t('entry.markAll') }}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="t('entry.reverse')"
        @click="store.toggleOrder()"
      >
        <ArrowDownUp class="size-4" />
      </Button>
    </div>

    <ul v-if="store.sorted.length > 0" class="divide-y divide-border pb-24 md:pb-8">
      <ItemRow
        v-for="item in store.sorted"
        :key="item.id"
        :item="item"
        openable
        :unit="itemWord"
        :job="downloads.byItem.get(item.id)"
        @open="open(item)"
        @toggle-seen="store.toggleSeen(item)"
        @toggle-bookmark="store.toggleBookmark(item)"
        @mark-up-to="store.markUpTo(item)"
        @download="downloads.download([item])"
        @remove-download="removeOne(item)"
      />
    </ul>

    <p v-else-if="!store.refreshing" class="px-4 py-10 text-center text-sm text-muted-foreground">
      {{ t('entry.emptyItems', { unit: itemWord }) }}
    </p>
  </template>

  <EmptyState
    v-else-if="!store.loading && store.error"
    :icon="TriangleAlert"
    :title="t('entry.errorTitle')"
    :description="t('entry.errorDescription')"
  />
</template>
