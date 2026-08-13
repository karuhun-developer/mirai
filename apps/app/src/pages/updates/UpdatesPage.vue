<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, RefreshCw } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ItemLine from '@/components/entry/ItemLine.vue'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/i18n'
import { useUpdatesStore } from '@/stores/updates'
import { useExtensionsStore } from '@/stores/extensions'

const { t } = useI18n()
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
</script>

<template>
  <AppHeader :title="t('updates.title')" show-refresh @refresh="refresh" />

  <div
    v-if="store.progress"
    class="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground"
  >
    <RefreshCw class="size-3.5 animate-spin" />
    <span class="flex-1 truncate">
      {{ t('updates.progress', store.progress) }}
    </span>
    <Button variant="ghost" size="sm" @click="store.cancel()">{{ t('common.cancel') }}</Button>
  </div>

  <p
    v-else-if="store.report"
    class="px-4 py-2 text-xs text-muted-foreground"
    data-testid="updates-report"
  >
    {{ t('updates.report', store.report) }}
    <span v-if="store.report.skipped.length > 0">
      {{ t('updates.skipped', { count: store.report.skipped.length }) }}
    </span>
    <span v-if="store.report.failures.length > 0" class="text-destructive">
      {{ t('updates.failed', { count: store.report.failures.length }) }}
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
      :meta="formatDateTime(update.added_at)"
      :dimmed="update.seen === 1"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="update.seen === 1 ? t('updates.markUnread') : t('updates.markRead')"
        @click="store.markSeen(update, update.seen === 0)"
      >
        <Check class="size-4" :class="update.seen === 1 ? 'text-primary' : ''" />
      </Button>
    </ItemLine>
  </ul>

  <EmptyState
    v-else-if="!store.loading"
    :icon="RefreshCw"
    :title="t('updates.emptyTitle')"
    :description="t('updates.emptyDescription')"
  >
    <Button variant="outline" @click="refresh">{{ t('updates.refreshNow') }}</Button>
  </EmptyState>
</template>
