<script setup lang="ts">
import EntryCard from './EntryCard.vue'
import type { GridEntry } from './grid'

defineProps<{ entries: GridEntry[] }>()
</script>

<template>
  <!--
    Kolom mengikuti lebar kartu, bukan jumlah tetap: 2 kolom di 375px sampai
    memenuhi layar lebar tanpa perlu daftar breakpoint yang harus dijaga.
  -->
  <div
    data-testid="entry-grid"
    class="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3 px-4 pb-24 md:pb-8"
  >
    <EntryCard v-for="entry in entries" :key="`${entry.sourceId}::${entry.url}`" :entry="entry" />
  </div>
</template>
