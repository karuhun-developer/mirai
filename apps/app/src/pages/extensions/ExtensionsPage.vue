<script setup lang="ts">
import { Puzzle } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <AppHeader title="Extension" show-search show-refresh />

  <EmptyState
    :icon="Puzzle"
    title="Manajemen extension belum aktif"
    description="Menambah repo, memasang, dan meng-update sumber masuk di Fase 2."
  />
</template>
