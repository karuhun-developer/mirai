<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVirtualWindow } from '@/composables/useVirtualWindow'
import EntryCard from './EntryCard.vue'
import type { GridEntry } from './grid'

const props = defineProps<{ entries: GridEntry[] }>()

const grid = ref<HTMLElement | null>(null)

/**
 * Library besar bisa berisi ribuan judul, dan tiap kartu menahan satu blob
 * cover di memori. Tinggi awalnya sekadar tebakan sampai kartu pertama
 * benar-benar terukur — lihat `useVirtualWindow`.
 */
const { from, to, spacer } = useVirtualWindow(grid, () => props.entries.length, { estimate: 220 })

const visible = computed(() => props.entries.slice(from.value, to.value))
</script>

<template>
  <div class="px-4 pb-24 md:pb-8">
    <!--
      Kolom mengikuti lebar kartu, bukan jumlah tetap: 2 kolom di 375px sampai
      memenuhi layar lebar tanpa perlu daftar breakpoint yang harus dijaga.
    -->
    <div
      ref="grid"
      data-testid="entry-grid"
      class="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3"
      :style="spacer"
    >
      <EntryCard v-for="entry in visible" :key="`${entry.sourceId}::${entry.url}`" :entry="entry" />
    </div>
  </div>
</template>
