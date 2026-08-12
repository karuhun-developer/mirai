<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Download, History, Puzzle, Settings, Info, ChevronRight } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'

/**
 * Di mobile, tujuan yang tidak muat di lima slot BottomNav ditampung di sini.
 * Di desktop, tiga yang pertama sudah punya barisnya sendiri di SideRail —
 * halaman ini tetap ada supaya deep link dari mana pun tidak buntu.
 */
const links = [
  {
    to: '/history',
    label: 'Riwayat',
    description: 'Yang terakhir dibaca & ditonton',
    icon: History,
  },
  { to: '/downloads', label: 'Unduhan', description: 'Antrean & isi offline', icon: Download },
  { to: '/extensions', label: 'Extension', description: 'Repo & sumber', icon: Puzzle },
  { to: '/settings', label: 'Pengaturan', description: 'Tampilan & penyimpanan', icon: Settings },
  { to: '/about', label: 'Tentang', description: 'Versi & lisensi', icon: Info },
]
</script>

<template>
  <AppHeader title="Lainnya" />

  <ul class="mx-auto max-w-2xl divide-y divide-border">
    <li v-for="link in links" :key="link.to">
      <RouterLink
        :to="link.to"
        class="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-secondary"
      >
        <component :is="link.icon" class="size-5 shrink-0 text-muted-foreground" />
        <span class="flex-1">
          <span class="block text-sm font-medium">{{ link.label }}</span>
          <span class="block text-xs text-muted-foreground">{{ link.description }}</span>
        </span>
        <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
      </RouterLink>
    </li>
  </ul>
</template>
