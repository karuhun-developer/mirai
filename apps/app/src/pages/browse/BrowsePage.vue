<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Compass } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'
</script>

<template>
  <AppHeader title="Browse" show-search />

  <EmptyState
    :icon="Compass"
    title="Belum ada sumber terpasang"
    description="Mirai tidak membawa sumber bawaan. Tambahkan repo extension dulu, lalu pasang sumber yang kamu mau."
  >
    <Button as-child>
      <RouterLink to="/extensions">Buka Extension</RouterLink>
    </Button>
  </EmptyState>
</template>
