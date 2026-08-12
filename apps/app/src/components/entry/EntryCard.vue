<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SEntry } from '@mirai/extension-api'
import { transport } from '@/services/extensions'

const props = defineProps<{
  entry: SEntry
  /** Jumlah chapter/episode belum dibaca; badge disembunyikan kalau nol. */
  unread?: number
  downloaded?: boolean
}>()

const failed = ref(false)

// Di APK URL cover dipakai apa adanya; di web dia harus lewat proxy, karena CDN
// sumber hampir tidak pernah memasang header CORS.
const coverUrl = computed(() =>
  props.entry.thumbnailUrl ? transport.media.toDisplayUrl(props.entry.thumbnailUrl) : '',
)
</script>

<template>
  <article class="group flex flex-col gap-1.5">
    <div class="relative aspect-2/3 overflow-hidden rounded-lg bg-surface">
      <img
        v-if="coverUrl && !failed"
        :src="coverUrl"
        :alt="entry.title"
        loading="lazy"
        decoding="async"
        class="size-full object-cover transition-transform duration-200 group-hover:scale-105"
        @error="failed = true"
      />
      <div
        v-else
        class="grid size-full place-items-center px-2 text-center text-xs text-muted-foreground"
      >
        {{ entry.title }}
      </div>

      <span
        v-if="unread"
        class="absolute left-1.5 top-1.5 rounded-full bg-unread px-1.5 py-0.5 text-[11px] font-semibold leading-none text-unread-foreground"
      >
        {{ unread }}
      </span>
      <span
        v-if="downloaded"
        class="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-downloaded"
        aria-label="Sudah diunduh"
      />
    </div>

    <p class="line-clamp-2 text-xs leading-snug text-foreground/90">{{ entry.title }}</p>
  </article>
</template>
