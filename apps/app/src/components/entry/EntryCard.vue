<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { Heart } from '@lucide/vue'
import { useCover } from '@/composables/useCover'
import { entryLocation } from '@/router/links'
import type { GridEntry } from './grid'

const { t } = useI18n()

const props = defineProps<{ entry: GridEntry }>()

const { src, failed } = useCover(() => props.entry.thumbnailUrl)

const to = computed(() => entryLocation(props.entry.kind, props.entry.sourceId, props.entry.url))
</script>

<template>
  <RouterLink :to="to" class="group flex flex-col gap-1.5 focus-visible:outline-none">
    <div
      class="relative aspect-2/3 overflow-hidden rounded-lg bg-surface ring-offset-background group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2"
    >
      <img
        v-if="src && !failed"
        :src="src"
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
        v-if="entry.unread"
        class="absolute left-1.5 top-1.5 rounded-full bg-unread px-1.5 py-0.5 text-[11px] font-semibold leading-none text-unread-foreground"
      >
        {{ entry.unread }}
      </span>
      <span
        v-if="entry.downloaded"
        class="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-downloaded"
        :aria-label="t('entry.downloadedBadge')"
      />
      <!--
        Penanda favorit cuma dipakai di Browse: di Library semuanya favorit, jadi
        di sana `favorite` sengaja tidak dikirim supaya ikonnya tidak muncul di
        tiap kartu tanpa memberi tahu apa pun.
      -->
      <span
        v-if="entry.favorite"
        class="absolute bottom-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-background/80"
        :aria-label="t('entry.inLibraryBadge')"
      >
        <Heart class="size-3 fill-primary text-primary" />
      </span>
    </div>

    <p class="line-clamp-2 text-xs leading-snug text-foreground/90">{{ entry.title }}</p>
  </RouterLink>
</template>
