<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from './BottomNav.vue'
import SideRail from './SideRail.vue'

const route = useRoute()

/**
 * Reader dan player mengambil alih seluruh layar — nav apa pun di sana justru
 * menghalangi. Halaman menandainya lewat `meta.fullscreen`, bukan lewat daftar
 * path di sini, supaya rute baru tidak perlu mengedit shell.
 */
const isFullscreen = computed(() => route.meta.fullscreen === true)
</script>

<template>
  <div class="min-h-full">
    <template v-if="isFullscreen">
      <RouterView />
    </template>

    <template v-else>
      <SideRail />
      <!--
        Padding kiri mengimbangi rail yang `fixed`; padding bawah memberi ruang
        untuk BottomNav supaya baris terakhir grid tidak tertutup.
      -->
      <div class="md:pl-16 lg:pl-60">
        <main class="pb-safe min-h-dvh pb-20 md:pb-0">
          <RouterView />
        </main>
      </div>
      <BottomNav />
    </template>
  </div>
</template>
