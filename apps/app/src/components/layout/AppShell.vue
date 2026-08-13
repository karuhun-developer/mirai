<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BottomNav from './BottomNav.vue'
import SideRail from './SideRail.vue'

const { t } = useI18n()
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
      <!--
        Tautan lompat: tanpa ini, papan ketik dan pembaca layar harus melewati
        tujuh tautan navigasi yang sama persis di setiap halaman sebelum sampai
        ke isinya. Tersembunyi sampai difokuskan.
      -->
      <a
        href="#konten"
        class="sr-only rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        {{ t('common.skipToContent') }}
      </a>

      <SideRail />
      <!--
        Padding kiri mengimbangi rail yang `fixed`; padding bawah memberi ruang
        untuk BottomNav supaya baris terakhir grid tidak tertutup.
      -->
      <div class="md:pl-16 lg:pl-60">
        <!-- `tabindex="-1"` supaya fokus benar-benar berpindah ke sini waktu
             tautan lompat diikuti; tanpa itu sebagian browser cuma menggulung. -->
        <main id="konten" tabindex="-1" class="pb-safe min-h-dvh pb-20 outline-none md:pb-0">
          <RouterView />
        </main>
      </div>
      <BottomNav />
    </template>
  </div>
</template>
