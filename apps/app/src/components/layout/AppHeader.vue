<script setup lang="ts">
import { Search, SlidersHorizontal, RefreshCw } from '@lucide/vue'
import { Button } from '@/components/ui/button'

defineProps<{
  title: string
  /** Aksi header mengikuti halaman — Library butuh filter, Updates cukup refresh. */
  showSearch?: boolean
  showFilter?: boolean
  showRefresh?: boolean
}>()

const emit = defineEmits<{
  search: []
  filter: []
  refresh: []
}>()
</script>

<template>
  <header
    class="pt-safe sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm"
  >
    <div class="flex h-14 items-center gap-1 px-4">
      <h1 class="flex-1 truncate text-xl font-semibold tracking-tight">{{ title }}</h1>

      <Button
        v-if="showSearch"
        variant="ghost"
        size="icon"
        aria-label="Cari"
        @click="emit('search')"
      >
        <Search />
      </Button>
      <Button
        v-if="showFilter"
        variant="ghost"
        size="icon"
        aria-label="Filter"
        @click="emit('filter')"
      >
        <SlidersHorizontal />
      </Button>
      <Button
        v-if="showRefresh"
        variant="ghost"
        size="icon"
        aria-label="Muat ulang"
        @click="emit('refresh')"
      >
        <RefreshCw />
      </Button>
    </div>

    <slot name="tabs" />
  </header>
</template>
