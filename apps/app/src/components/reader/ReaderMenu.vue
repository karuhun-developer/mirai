<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Settings2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'

/**
 * Bilah atas + bawah reader.
 *
 * Muncul lewat ketukan di tengah layar dan menutupi gambar, jadi isinya dibatasi
 * pada yang benar-benar butuh dilihat sambil membaca: keluar, judul, penggeser
 * halaman, dan lompat chapter.
 */
const { t } = useI18n()

const props = defineProps<{
  title: string
  chapter: string
  /** Nomor urut chapter di antara semuanya, untuk "3 dari 120". */
  position: number
  totalItems: number
  page: number
  total: number
  index: number
  rightToLeft: boolean
  hasPrevious: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{
  close: []
  seek: [value: number]
  previous: []
  next: []
  settings: []
}>()

function onSeek(event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement) emit('seek', Number(target.value))
}

/**
 * Di RTL penggesernya dibalik supaya arah geser cocok dengan arah baca. Nilainya
 * tetap indeks yang sama — cuma penyajiannya yang tercermin.
 */
const dir = computed(() => (props.rightToLeft ? 'rtl' : 'ltr'))

/** Tombol "chapter sebelumnya" pindah sisi di RTL, mengikuti arah bacanya. */
const backIcon = computed(() => (props.rightToLeft ? ChevronRight : ChevronLeft))
const forwardIcon = computed(() => (props.rightToLeft ? ChevronLeft : ChevronRight))
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between">
    <header
      class="pointer-events-auto flex items-center gap-2 bg-gradient-to-b from-black/85 to-transparent px-2 py-2 pt-safe text-white"
    >
      <Button
        variant="ghost"
        size="icon"
        class="text-white"
        :aria-label="t('reader.close')"
        @click="emit('close')"
      >
        <X />
      </Button>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ title }}</p>
        <p class="truncate text-xs text-white/70">
          {{ chapter }}
          <span v-if="totalItems > 0">
            · {{ t('reader.position', { position, total: totalItems }) }}
          </span>
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        class="text-white"
        :aria-label="t('reader.settings')"
        @click="emit('settings')"
      >
        <Settings2 />
      </Button>
    </header>

    <footer
      class="pointer-events-auto space-y-1 bg-gradient-to-t from-black/85 to-transparent px-2 py-2 pb-safe text-white"
    >
      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          class="text-white disabled:opacity-30"
          :disabled="!hasPrevious"
          :aria-label="t('reader.previousChapter')"
          @click="emit('previous')"
        >
          <component :is="backIcon" />
        </Button>

        <input
          type="range"
          class="h-1 flex-1 accent-primary"
          :dir="dir"
          min="0"
          :max="Math.max(total - 1, 0)"
          :value="index"
          :disabled="total <= 1"
          :aria-label="t('reader.seek')"
          @input="onSeek"
        />

        <Button
          variant="ghost"
          size="icon"
          class="text-white disabled:opacity-30"
          :disabled="!hasNext"
          :aria-label="t('reader.nextChapter')"
          @click="emit('next')"
        >
          <component :is="forwardIcon" />
        </Button>
      </div>

      <p class="text-center text-xs tabular-nums text-white/70">{{ page }} / {{ total }}</p>
    </footer>
  </div>
</template>
