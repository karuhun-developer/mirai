<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen, Clapperboard, Compass } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'
import { useExtensionsStore } from '@/stores/extensions'

const store = useExtensionsStore()

onMounted(() => void store.ensureLoaded())
</script>

<template>
  <AppHeader title="Browse" show-refresh @refresh="store.refreshAll()" />

  <p v-if="store.state === 'loading'" class="px-4 py-6 text-sm text-muted-foreground">
    Memuat extension…
  </p>

  <EmptyState
    v-else-if="store.sources.length === 0"
    :icon="Compass"
    title="Belum ada sumber aktif"
    description="Mirai tidak membawa sumber bawaan. Tambahkan repo extension dulu, lalu pasang sumber yang kamu mau."
  >
    <Button as-child>
      <RouterLink to="/extensions">Buka Extension</RouterLink>
    </Button>
  </EmptyState>

  <template v-else>
    <p
      v-if="store.error"
      class="mx-4 mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
    >
      {{ store.error }}
    </p>

    <ul class="flex flex-col gap-1 p-4">
      <li v-for="source in store.sources" :key="source.id">
        <RouterLink
          :to="{ name: 'browse-source', params: { sourceId: source.id } }"
          class="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-secondary"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-md bg-secondary">
            <component :is="source.kind === 'manga' ? BookOpen : Clapperboard" class="size-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ source.name }}</span>
            <span class="block truncate text-xs text-muted-foreground">
              {{ source.info.lang.toUpperCase() }} · {{ source.kind }}
            </span>
          </span>
        </RouterLink>
      </li>
    </ul>
  </template>
</template>
