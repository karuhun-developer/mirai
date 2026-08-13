<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImageOff, LoaderCircle } from '@lucide/vue'
import type { PageFit } from '@/services/reader.service'

/**
 * Satu halaman manga.
 *
 * Yang membuat komponen ini ada — bukan `<img>` telanjang — adalah **gagalnya
 * satu gambar tidak boleh mematikan chapternya.** CDN manga rutin menolak
 * sebagian permintaan (rate limit, node yang sedang buruk), dan halaman yang
 * kosong tanpa penjelasan membuat pembacanya menyangka chapternya rusak. Di
 * sini kegagalan punya tombolnya sendiri, dan mencoba ulang cukup memasang
 * ulang elemennya lewat `:key` — tanpa menambah parameter ke URL, yang di web
 * akan mengubah alamat proxy dan membatalkan cache-nya.
 */
const { t } = useI18n()

const props = defineProps<{
  src: string
  alt: string
  fit: PageFit
  /** Halaman yang sedang dilihat diambil segera; sisanya menyusul. */
  eager?: boolean
}>()

const attempt = ref(0)
const loaded = ref(false)
const failed = ref(false)

// Halaman yang sama dipakai ulang saat indeks bergeser (jendela preload
// bergerak), jadi keadaannya harus ikut berganti bersama URL-nya.
watch(
  () => props.src,
  () => {
    attempt.value = 0
    loaded.value = false
    failed.value = false
  },
)

function retry(): void {
  loaded.value = false
  failed.value = false
  attempt.value += 1
}

const imageClass = computed(() => {
  if (props.fit === 'height') return 'h-dvh w-auto max-w-none object-contain'
  if (props.fit === 'contain') return 'max-h-dvh max-w-full object-contain'
  return 'w-full h-auto'
})
</script>

<template>
  <!--
    Tinggi cadangan selama gambar belum ada bukan sekadar hiasan: di mode gulir,
    halaman yang belum dimuat menumpuk pendek-pendek dan beberapa sekaligus
    melewati pita "sedang dibaca" di tengah layar, jadi chapter yang baru dibuka
    langsung tercatat maju beberapa halaman. Setelah gambarnya masuk, tingginya
    dilepas supaya tidak ada celah antar potongan webtoon.
  -->
  <div
    class="relative flex w-full items-center justify-center"
    :class="loaded ? 'min-h-0' : 'min-h-[70vh]'"
  >
    <img
      v-if="!failed"
      :key="attempt"
      :src="src"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      draggable="false"
      class="select-none"
      :class="[imageClass, loaded ? '' : 'opacity-0']"
      @load="loaded = true"
      @error="failed = true"
    />

    <!-- Penanda muat menumpang di atas gambar yang belum tampil supaya tinggi
         wadahnya tidak melompat begitu gambarnya masuk. -->
    <div
      v-if="!loaded && !failed"
      class="absolute inset-0 grid place-items-center bg-surface/40 py-16 text-muted-foreground"
    >
      <LoaderCircle class="size-6 animate-spin" />
    </div>

    <div v-if="failed" class="grid place-items-center gap-2 px-6 py-16 text-center">
      <ImageOff class="size-6 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">{{ t('reader.imageFailed', { alt }) }}</p>
      <button
        type="button"
        class="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium"
        @click.stop="retry"
      >
        {{ t('common.retry') }}
      </button>
    </div>
  </div>
</template>
