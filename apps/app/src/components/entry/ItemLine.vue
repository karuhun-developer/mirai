<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { EntryKind } from '@mirai/db'
import { useCover } from '@/composables/useCover'
import { entryLocation } from '@/router/links'

/**
 * Satu baris "item milik sebuah entri" — bentuk yang sama dipakai Updates dan
 * Riwayat. Keduanya menampilkan cover kecil, judul entri, nama item, dan satu
 * baris keterangan; menyatukannya menjaga tinggi baris dan perilaku tautan
 * tetap sama di dua halaman.
 */
const props = defineProps<{
  kind: EntryKind
  sourceId: string
  entryUrl: string
  entryTitle: string
  thumbnailUrl: string | null
  itemName: string
  meta?: string
  dimmed?: boolean
}>()

const { src, failed } = useCover(() => props.thumbnailUrl)
const to = computed(() => entryLocation(props.kind, props.sourceId, props.entryUrl))
</script>

<template>
  <li class="flex items-center gap-3 px-4 py-2" :class="dimmed ? 'opacity-50' : ''">
    <RouterLink :to="to" class="flex min-w-0 flex-1 items-center gap-3">
      <div class="w-10 shrink-0 overflow-hidden rounded bg-surface">
        <img
          v-if="src && !failed"
          :src="src"
          :alt="entryTitle"
          loading="lazy"
          class="aspect-2/3 size-full object-cover"
        />
        <div v-else class="aspect-2/3" />
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ entryTitle }}</p>
        <p class="truncate text-xs text-muted-foreground">{{ itemName }}</p>
        <p v-if="meta" class="truncate text-xs text-muted-foreground/70">{{ meta }}</p>
      </div>
    </RouterLink>

    <slot />
  </li>
</template>
