<script setup lang="ts">
import { onMounted } from 'vue'
import { History, Trash2 } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ItemLine from '@/components/entry/ItemLine.vue'
import { Button } from '@/components/ui/button'
import { useHistoryStore } from '@/stores/history'

const store = useHistoryStore()

onMounted(() => {
  void store.load()
})

function when(value: number): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <AppHeader title="Riwayat">
    <template #tabs>
      <div v-if="store.items.length > 0" class="px-4 pb-3">
        <Button variant="outline" size="sm" @click="store.clear()">Hapus semua riwayat</Button>
      </div>
    </template>
  </AppHeader>

  <p v-if="store.error" class="mx-4 mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
    {{ store.error }}
  </p>

  <ul v-if="store.items.length > 0" class="divide-y divide-border pb-24 md:pb-8">
    <ItemLine
      v-for="row in store.items"
      :key="row.item_id"
      :kind="row.entry_kind"
      :source-id="row.source_id"
      :entry-url="row.entry_url"
      :entry-title="row.entry_title"
      :thumbnail-url="row.entry_thumbnail"
      :item-name="row.item_name"
      :meta="when(row.read_at)"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Hapus dari riwayat"
        @click="store.remove(row.item_id)"
      >
        <Trash2 class="size-4" />
      </Button>
    </ItemLine>
  </ul>

  <EmptyState
    v-else-if="!store.loading"
    :icon="History"
    title="Riwayat masih kosong"
    description="Chapter dan episode yang sudah kamu baca atau tonton akan tercatat di sini — seluruhnya tersimpan lokal."
  />
</template>
