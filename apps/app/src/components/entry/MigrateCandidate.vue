<script setup lang="ts">
import type { SEntry } from '@mirai/extension-api'
import { useCover } from '@/composables/useCover'

/**
 * Satu hasil pencarian di source tujuan.
 *
 * Sampulnya ikut ditampilkan, bukan judulnya saja: dua judul yang ejaannya
 * nyaris sama (sekuel, spin-off, versi berwarna) baru bisa dibedakan dari
 * gambarnya, dan salah pilih di sini berarti memindahkan progres baca ke judul
 * yang keliru.
 */
const props = defineProps<{ entry: SEntry; selected: boolean }>()
defineEmits<{ select: [] }>()

const { src, failed } = useCover(() => props.entry.thumbnailUrl ?? null)
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center gap-3 rounded-md p-2 text-left"
    :class="selected ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-surface/60'"
    :aria-pressed="selected"
    @click="$emit('select')"
  >
    <div class="h-16 w-11 shrink-0 overflow-hidden rounded bg-surface">
      <img
        v-if="src && !failed"
        :src="src"
        :alt="entry.title"
        loading="lazy"
        decoding="async"
        class="size-full object-cover"
        @error="failed = true"
      />
    </div>
    <span class="line-clamp-2 min-w-0 flex-1 text-sm">{{ entry.title }}</span>
  </button>
</template>
