<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Search, SlidersHorizontal, RefreshCw } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const { t } = useI18n()

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
        :aria-label="t('common.search')"
        @click="emit('search')"
      >
        <Search />
      </Button>
      <Button
        v-if="showFilter"
        variant="ghost"
        size="icon"
        :aria-label="t('common.filter')"
        @click="emit('filter')"
      >
        <SlidersHorizontal />
      </Button>
      <Button
        v-if="showRefresh"
        variant="ghost"
        size="icon"
        :aria-label="t('common.refresh')"
        @click="emit('refresh')"
      >
        <RefreshCw />
      </Button>
    </div>

    <slot name="tabs" />
  </header>
</template>
