<script setup lang="ts">
import { onMounted } from 'vue'
import { Check, RefreshCw } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ItemLine from '@/components/entry/ItemLine.vue'
import { Button } from '@/components/ui/button'
import { useUpdatesStore } from '@/stores/updates'
import { useExtensionsStore } from '@/stores/extensions'

const store = useUpdatesStore()
const extensions = useExtensionsStore()

onMounted(async () => {
  // Daftarnya dibaca dari database dulu; penyegaran tidak otomatis berjalan
  // karena membuka app di data seluler tidak boleh langsung menembak puluhan
  // situs sumber tanpa diminta.
  await store.load()
  await extensions.ensureLoaded()
})

function refresh(): void {
  void store.refresh((sourceId) => extensions.byId(sourceId))
}

function when(value: number): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <AppHeader title="Updates" show-refresh @refresh="refresh" />

  <div
    v-if="store.progress"
    class="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground"
  >
    <RefreshCw class="size-3.5 animate-spin" />
    <span class="flex-1 truncate">
      {{ store.progress.done }}/{{ store.progress.total }} — {{ store.progress.title }}
    </span>
    <Button variant="ghost" size="sm" @click="store.cancel()">Batal</Button>
  </div>

  <p
    v-else-if="store.report"
    class="px-4 py-2 text-xs text-muted-foreground"
    data-testid="updates-report"
  >
    {{ store.report.checked }} judul diperiksa, {{ store.report.added }} item baru.
    <span v-if="store.report.skipped.length > 0">
      {{ store.report.skipped.length }} dilewati (extension tidak terpasang).
    </span>
    <span v-if="store.report.failures.length > 0" class="text-destructive">
      {{ store.report.failures.length }} gagal.
    </span>
  </p>

  <p v-if="store.error" class="mx-4 mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
    {{ store.error }}
  </p>

  <ul v-if="store.items.length > 0" class="divide-y divide-border pb-24 md:pb-8">
    <ItemLine
      v-for="update in store.items"
      :key="update.id"
      :kind="update.entry_kind"
      :source-id="update.source_id"
      :entry-url="update.entry_url"
      :entry-title="update.entry_title"
      :thumbnail-url="update.entry_thumbnail"
      :item-name="update.name"
      :meta="when(update.added_at)"
      :dimmed="update.seen === 1"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="update.seen === 1 ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'"
        @click="store.markSeen(update, update.seen === 0)"
      >
        <Check class="size-4" :class="update.seen === 1 ? 'text-primary' : ''" />
      </Button>
    </ItemLine>
  </ul>

  <EmptyState
    v-else-if="!store.loading"
    :icon="RefreshCw"
    title="Belum ada update"
    description="Chapter dan episode baru dari judul di library kamu akan muncul di sini setelah disegarkan."
  >
    <Button variant="outline" @click="refresh">Segarkan sekarang</Button>
  </EmptyState>
</template>
