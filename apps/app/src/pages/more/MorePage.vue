<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { Download, History, Puzzle, Settings, Info, ChevronRight } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'

const { t } = useI18n()

/**
 * Di mobile, tujuan yang tidak muat di lima slot BottomNav ditampung di sini.
 * Di desktop, tiga yang pertama sudah punya barisnya sendiri di SideRail —
 * halaman ini tetap ada supaya deep link dari mana pun tidak buntu.
 */
const links = [
  { to: '/history', labelKey: 'nav.history', descriptionKey: 'more.history', icon: History },
  { to: '/downloads', labelKey: 'nav.downloads', descriptionKey: 'more.downloads', icon: Download },
  {
    to: '/extensions',
    labelKey: 'nav.extensions',
    descriptionKey: 'more.extensions',
    icon: Puzzle,
  },
  { to: '/settings', labelKey: 'nav.settings', descriptionKey: 'more.settings', icon: Settings },
  { to: '/about', labelKey: 'nav.about', descriptionKey: 'more.about', icon: Info },
]
</script>

<template>
  <AppHeader :title="t('more.title')" />

  <ul class="mx-auto max-w-2xl divide-y divide-border">
    <li v-for="link in links" :key="link.to">
      <RouterLink
        :to="link.to"
        class="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-secondary"
      >
        <component :is="link.icon" class="size-5 shrink-0 text-muted-foreground" />
        <span class="flex-1">
          <span class="block text-sm font-medium">{{ t(link.labelKey) }}</span>
          <span class="block text-xs text-muted-foreground">{{ t(link.descriptionKey) }}</span>
        </span>
        <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
      </RouterLink>
    </li>
  </ul>
</template>
