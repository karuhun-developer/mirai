<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from '@/components/layout/AppShell.vue'
import { useDownloadsStore } from '@/stores/downloads'
import { useExtensionsStore } from '@/stores/extensions'

const extensions = useExtensionsStore()
const downloads = useDownloadsStore()

/**
 * Antrean unduhan dinyalakan di akar, bukan di halaman Unduhan: pekerjaan yang
 * tertinggal dari sesi sebelumnya harus lanjut sendiri walau yang dibuka
 * Library. Extension dimuat lebih dulu — tanpa sumbernya, pekerjaan pertama
 * langsung gagal dengan "extension tidak terpasang".
 */
async function start(): Promise<void> {
  await extensions.ensureLoaded()
  await downloads.boot((sourceId) => extensions.byId(sourceId))
}

onMounted(() => {
  void start()
})
</script>

<template>
  <AppShell />
</template>
