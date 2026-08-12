<script setup lang="ts">
import { useRoute } from 'vue-router'
import { cn } from '@/lib/utils'
import { navItems, isNavActive } from './navItems'

const route = useRoute()
</script>

<template>
  <nav
    class="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden"
    aria-label="Navigasi utama"
  >
    <ul class="flex">
      <li v-for="item in navItems" :key="item.to" class="flex-1">
        <RouterLink
          :to="item.to"
          :aria-current="isNavActive(route.path, item) ? 'page' : undefined"
          class="flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors"
          :class="
            cn(
              isNavActive(route.path, item)
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )
          "
        >
          <span
            class="flex h-7 w-12 items-center justify-center rounded-full transition-colors"
            :class="isNavActive(route.path, item) ? 'bg-accent' : ''"
          >
            <component :is="item.icon" class="size-5" />
          </span>
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
