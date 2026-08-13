<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Bookmark,
  Check,
  ChevronsDown,
  CircleCheck,
  Download,
  LoaderCircle,
  TriangleAlert,
} from '@lucide/vue'
import type { DownloadRow, ItemRow } from '@mirai/db'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/i18n'

const { t } = useI18n()

const props = defineProps<{
  item: ItemRow
  /**
   * Baris bisa dibuka. Baris yang bisa diketuk tapi tidak melakukan apa-apa
   * lebih membingungkan daripada baris yang jelas diam.
   */
  openable?: boolean
  /** Sebutannya di tombol dan label a11y: `chapter` atau `episode`. */
  unit?: string
  /** Pekerjaan unduhan item ini, kalau ada di antrean. */
  job?: DownloadRow | undefined
}>()

const emit = defineEmits<{
  open: []
  toggleSeen: []
  toggleBookmark: []
  markUpTo: []
  download: []
  removeDownload: []
}>()

const seen = computed(() => props.item.seen === 1)
const downloaded = computed(() => props.item.downloaded === 1)
const state = computed(() => props.job?.state)
const busy = computed(() => state.value === 'queued' || state.value === 'running')

/**
 * Satu tombol, empat arti — mengikuti keadaan yang paling mungkin dituju
 * berikutnya: yang gagal diulang, yang tersimpan dihapus, yang belum diunduh
 * diantre. Yang sedang berjalan tidak bisa diketuk; membatalkannya lewat
 * halaman Unduhan, tempat progresnya terlihat penuh.
 */
const downloadLabel = computed(() => {
  if (busy.value) return t('item.downloading', { progress: props.job?.progress ?? 0 })
  if (state.value === 'failed') return t('item.downloadFailed')
  if (downloaded.value) return t('item.removeDownload')
  return t('item.download', { unit: props.unit ?? t('entry.unitChapter') })
})

function onDownload(): void {
  if (busy.value) return
  if (downloaded.value && state.value !== 'failed') emit('removeDownload')
  else emit('download')
}

const subtitle = computed(() => {
  const parts: string[] = []
  if (props.item.date_upload !== null) {
    parts.push(formatDate(props.item.date_upload))
  }
  if (props.item.scanlator) parts.push(props.item.scanlator)
  // Progres cuma disebut kalau ada dan belum selesai — "halaman 0" bukan kabar.
  if (!seen.value && props.item.last_position > 0) {
    parts.push(t('item.resumeAt', { position: props.item.last_position }))
  }
  if (busy.value) parts.push(t('item.downloadingShort', { progress: props.job?.progress ?? 0 }))
  else if (state.value === 'failed') parts.push(t('item.failedShort'))
  else if (downloaded.value) parts.push(t('item.savedShort'))
  return parts.join(' · ')
})
</script>

<template>
  <li class="flex items-center gap-2 px-4 py-2.5" :class="seen ? 'opacity-50' : ''">
    <component
      :is="openable ? 'button' : 'div'"
      :type="openable ? 'button' : undefined"
      :data-testid="openable ? 'item-open' : undefined"
      class="min-w-0 flex-1 text-left"
      @click="openable && emit('open')"
    >
      <p class="truncate text-sm" :class="seen ? 'font-normal' : 'font-medium'">
        {{ item.name }}
      </p>
      <p v-if="subtitle" class="truncate text-xs text-muted-foreground">{{ subtitle }}</p>
    </component>

    <Button
      variant="ghost"
      size="icon-sm"
      data-testid="item-download"
      :aria-label="downloadLabel"
      :title="downloadLabel"
      @click="onDownload()"
    >
      <LoaderCircle v-if="busy" class="size-4 animate-spin text-primary" />
      <TriangleAlert v-else-if="state === 'failed'" class="size-4 text-destructive" />
      <CircleCheck v-else-if="downloaded" class="size-4 fill-primary text-background" />
      <Download v-else class="size-4" />
    </Button>

    <Button
      variant="ghost"
      size="icon-sm"
      :aria-label="item.bookmark === 1 ? t('item.removeBookmark') : t('item.bookmark')"
      @click="emit('toggleBookmark')"
    >
      <Bookmark class="size-4" :class="item.bookmark === 1 ? 'fill-primary text-primary' : ''" />
    </Button>

    <!--
      Menandai satu chapter biasanya berarti yang sebelumnya juga sudah dibaca —
      tombol terpisah ini menghemat puluhan ketukan pada judul panjang.
    -->
    <Button
      v-if="!seen"
      variant="ghost"
      size="icon-sm"
      :aria-label="t('item.markUpTo')"
      @click="emit('markUpTo')"
    >
      <ChevronsDown class="size-4" />
    </Button>

    <Button
      variant="ghost"
      size="icon-sm"
      :aria-label="seen ? t('item.markUnread') : t('item.markRead')"
      @click="emit('toggleSeen')"
    >
      <Check class="size-4" :class="seen ? 'text-primary' : ''" />
    </Button>
  </li>
</template>
