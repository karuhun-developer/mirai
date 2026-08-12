<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <AppHeader title="Updates" show-refresh />

  <EmptyState
    :icon="RefreshCw"
    title="Belum ada update"
    description="Chapter dan episode baru dari judul di library kamu akan muncul di sini."
  />
</template>
