<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { CircleAlert } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'
</script>

<template>
  <EmptyState
    :icon="CircleAlert"
    title="Halaman tidak ditemukan"
    description="Tautannya mungkin sudah berubah atau salah ketik."
  >
    <Button as-child variant="outline">
      <RouterLink to="/library/anime">Kembali ke Library</RouterLink>
    </Button>
  </EmptyState>
</template>
