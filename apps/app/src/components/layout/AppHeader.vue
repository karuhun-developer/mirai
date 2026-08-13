<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Search, SlidersHorizontal, RefreshCw, EyeOff } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { settings } from '@/services/settings.service'

const { t } = useI18n()

defineProps<{
  title: string
  /** Aksi header mengikuti halaman — Library butuh filter, Updates cukup refresh. */
  showSearch?: boolean
  showFilter?: boolean
  showRefresh?: boolean
}>()

const emit = defineEmits<{
  search: []
  filter: []
  refresh: []
}>()
</script>

<template>
  <header
    class="pt-safe sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm"
  >
    <div class="flex h-14 items-center gap-1 px-4">
      <h1 class="flex-1 truncate text-xl font-semibold tracking-tight">{{ title }}</h1>

      <!-- Penanda incognito duduk di header, bukan cuma di Pengaturan: mode yang
           membungkam pencatatan tanpa terlihat di mana pun adalah cara kehilangan
           riwayat seharian tanpa sadar. Ketukannya membuka setelannya. -->
      <RouterLink
        v-if="settings.incognito"
        to="/settings"
        class="mr-1 flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground"
        :title="t('settings.privacy.incognitoHint')"
      >
        <EyeOff class="size-3.5" />
        <span class="hidden sm:inline">{{ t('settings.privacy.incognito') }}</span>
        <span class="sr-only sm:hidden">{{ t('settings.privacy.incognito') }}</span>
      </RouterLink>

      <Button
        v-if="showSearch"
        variant="ghost"
        size="icon"
        :aria-label="t('common.search')"
        @click="emit('search')"
      >
        <Search />
      </Button>
      <Button
        v-if="showFilter"
        variant="ghost"
        size="icon"
        :aria-label="t('common.filter')"
        @click="emit('filter')"
      >
        <SlidersHorizontal />
      </Button>
      <Button
        v-if="showRefresh"
        variant="ghost"
        size="icon"
        :aria-label="t('common.refresh')"
        @click="emit('refresh')"
      >
        <RefreshCw />
      </Button>
    </div>

    <slot name="tabs" />
  </header>
</template>
