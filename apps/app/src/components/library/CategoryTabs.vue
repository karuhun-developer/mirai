<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CategoryTab } from '@/stores/library'

const { t } = useI18n()

defineProps<{ tabs: CategoryTab[]; active: string }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <!--
    Baris tab digulir mendatar, tidak dibungkus ke baris kedua: kategori bisa
    banyak, dan header yang tiba-tiba setinggi tiga baris menggeser seluruh grid
    setiap kali satu kategori ditambahkan.
  -->
  <div
    class="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    role="tablist"
    :aria-label="t('library.categories')"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="tab.id === active"
      class="shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors"
      :class="
        tab.id === active
          ? 'bg-secondary font-medium text-foreground'
          : 'text-muted-foreground hover:bg-secondary/60'
      "
      @click="emit('select', tab.id)"
    >
      {{ tab.name }}
      <span class="ml-1 text-xs text-muted-foreground">{{ tab.count }}</span>
    </button>
  </div>
</template>
