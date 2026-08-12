<script setup lang="ts">
import { Settings } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <AppHeader title="Pengaturan" />

  <EmptyState
    :icon="Settings"
    title="Belum ada yang bisa diatur"
    description="Tema, mode baca, kualitas video, dan penyimpanan menyusul di fase berikutnya."
  />
</template>
