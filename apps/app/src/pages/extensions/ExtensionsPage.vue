<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Puzzle } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ExtensionRow from '@/components/extensions/ExtensionRow.vue'
import RepoManager from '@/components/extensions/RepoManager.vue'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useExtensionsStore, type ExtensionView } from '@/stores/extensions'

const { t } = useI18n()
const store = useExtensionsStore()
const query = ref('')

onMounted(() => void store.ensureLoaded())

const filtered = computed<ExtensionView[]>(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) return store.view

  return store.view.filter(
    (row) =>
      row.entry.name.toLowerCase().includes(term) ||
      row.entry.sources.some((source) => source.name.toLowerCase().includes(term)),
  )
})

/**
 * Tiga kelompok, urutan mengikuti apa yang butuh perhatian: yang bisa di-update
 * dulu, lalu yang terpasang, baru sisanya. Tanpa pengelompokan, daftar repo yang
 * berisi ratusan paket membuat extension terpasang sendiri jadi sulit dicari.
 */
const groups = computed(() => [
  { title: t('extensions.groupUpdatable'), rows: filtered.value.filter((row) => row.updatable) },
  {
    title: t('extensions.groupInstalled'),
    rows: filtered.value.filter((row) => row.installed && !row.updatable),
  },
  { title: t('extensions.groupAvailable'), rows: filtered.value.filter((row) => !row.installed) },
])
</script>

<template>
  <AppHeader :title="t('extensions.title')" show-refresh @refresh="store.refreshAll()" />

  <!--
    Lebar dibatasi di layar besar: daftar sebaris-per-paket yang direntangkan
    sampai 1440px menyisakan jurang kosong antara nama dan tombolnya.
  -->
  <div class="mx-auto w-full max-w-3xl">
    <RepoManager />

    <section class="flex flex-col gap-3 px-4 pb-4">
      <Input
        v-model="query"
        :placeholder="t('extensions.searchPlaceholder')"
        :aria-label="t('extensions.searchPlaceholder')"
      />

      <label class="flex items-center gap-3 text-sm">
        <Switch
          :model-value="store.showNsfw"
          :aria-label="t('extensions.showNsfwLabel')"
          @update:model-value="store.setShowNsfw($event)"
        />
        <span class="min-w-0 flex-1">
          {{ t('extensions.showNsfw') }}
          <span class="block text-xs text-muted-foreground">
            {{ t('extensions.showNsfwHint') }}
          </span>
        </span>
      </label>
    </section>

    <p
      v-if="store.error"
      class="mx-4 mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
    >
      {{ store.error }}
    </p>

    <p v-if="store.state === 'loading'" class="px-4 py-6 text-sm text-muted-foreground">
      {{ t('extensions.loading') }}
    </p>

    <EmptyState
      v-else-if="store.view.length === 0"
      :icon="Puzzle"
      :title="t('extensions.emptyTitle')"
      :description="t('extensions.emptyDescription')"
    />

    <template v-else>
      <section v-for="group in groups" :key="group.title" class="px-4 pb-4">
        <template v-if="group.rows.length > 0">
          <h2 class="mb-2 text-sm font-semibold text-muted-foreground">
            {{ t('extensions.groupCount', { title: group.title, count: group.rows.length }) }}
          </h2>
          <ul class="flex flex-col gap-2">
            <ExtensionRow v-for="row in group.rows" :key="row.entry.pkg" :row="row" />
          </ul>
        </template>
      </section>

      <div class="h-20 md:h-4" />
    </template>
  </div>
</template>
