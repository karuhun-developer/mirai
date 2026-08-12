<script setup lang="ts">
import { Download } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <AppHeader title="Unduhan" />

  <EmptyState
    :icon="Download"
    title="Belum ada unduhan"
    description="Chapter dan episode yang kamu unduh bisa dibaca dan ditonton tanpa internet."
  />
</template>
