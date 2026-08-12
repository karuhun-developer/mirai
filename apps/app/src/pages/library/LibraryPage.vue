<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { Library } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'

const route = useRoute()

/**
 * Satu halaman melayani `/library/anime` dan `/library/manga`. Isinya identik
 * kecuali jenis entri yang ditampilkan, jadi memisahnya jadi dua komponen cuma
 * menggandakan kode header, tab, dan grid.
 */
const kind = computed(() => (route.params.kind === 'anime' ? 'anime' : 'manga'))
const title = computed(() => (kind.value === 'anime' ? 'Anime' : 'Manga'))
</script>

<template>
  <AppHeader :title="title" show-search show-filter show-refresh />

  <EmptyState
    :icon="Library"
    :title="`Library ${title} masih kosong`"
    description="Pasang extension lalu tandai judul sebagai favorit — isinya akan tetap ada walau kamu sedang offline."
  >
    <Button as-child>
      <RouterLink to="/browse">Jelajahi sumber</RouterLink>
    </Button>
  </EmptyState>
</template>
