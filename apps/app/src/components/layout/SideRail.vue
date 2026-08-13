<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Download, Settings, Puzzle } from '@lucide/vue'
import { navItems, isNavActive } from './navItems'

const route = useRoute()
const { t } = useI18n()

/**
 * Di desktop ada ruang lebih, jadi dua tujuan yang di mobile bersembunyi di
 * balik "Lainnya" diangkat jadi baris tersendiri.
 */
const secondaryItems = [
  { to: '/downloads', labelKey: 'nav.downloads', icon: Download, match: '/downloads' },
  { to: '/extensions', labelKey: 'nav.extensions', icon: Puzzle, match: '/extensions' },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, match: '/settings' },
]
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-40 hidden w-16 shrink-0 flex-col border-r border-border bg-card md:flex lg:w-60"
    :aria-label="t('common.mainNav')"
  >
    <RouterLink
      to="/library/anime"
      class="flex h-14 items-center gap-2 px-4 text-primary lg:px-5"
      :aria-label="t('nav.home')"
    >
      <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 font-bold">
        M
      </span>
      <span class="hidden text-lg font-semibold tracking-tight lg:inline">Mirai</span>
    </RouterLink>

    <nav class="flex flex-1 flex-col gap-1 p-2">
      <RouterLink
        v-for="item in [...navItems.slice(0, 4), ...secondaryItems]"
        :key="item.to"
        :to="item.to"
        :title="t(item.labelKey)"
        :aria-current="isNavActive(route.path, item) ? 'page' : undefined"
        class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
        :class="
          isNavActive(route.path, item)
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        "
      >
        <component :is="item.icon" class="size-5 shrink-0" />
        <span class="hidden lg:inline">{{ t(item.labelKey) }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>
