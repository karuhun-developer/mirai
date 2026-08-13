<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ReaderImage from './ReaderImage.vue'
import { useZoomPan } from '@/composables/useZoomPan'
import type { PageFit, ReaderPage } from '@/services/reader.service'

/**
 * Mode halaman per halaman — bentuk manga cetak.
 *
 * Dua keputusan yang menentukan isinya:
 *
 * 1. **Halaman tetangga ikut dipasang di DOM**, cuma disembunyikan. Itulah
 *    preload-nya: browser sudah mengambil gambar berikutnya sebelum diminta,
 *    jadi berpindah halaman terasa seketika. Menyimpannya di objek `Image()`
 *    lepas juga bisa, tapi elemen yang sama persis menjamin yang dipakai nanti
 *    memang yang sudah ada di cache.
 * 2. **Arah baca cuma membalik makna sisi layar**, bukan urutan daftarnya.
 *    Halaman ke-3 tetap halaman ke-3 di RTL; yang berubah hanya sisi mana yang
 *    berarti "maju".
 */
const { t } = useI18n()

const props = defineProps<{
  pages: ReaderPage[]
  index: number
  fit: PageFit
  preload: number
  tapZones: boolean
  rightToLeft: boolean
}>()

const emit = defineEmits<{
  forward: []
  backward: []
  menu: []
}>()

/** Sisi kiri layar: maju kalau RTL, mundur kalau LTR. */
function left(): void {
  if (props.rightToLeft) emit('forward')
  else emit('backward')
}

function right(): void {
  if (props.rightToLeft) emit('backward')
  else emit('forward')
}

const { scale, zoomed, style, reset, onPointerDown, onPointerMove, onPointerUp } = useZoomPan({
  onTap(ratio) {
    // Tanpa tap zone seluruh layar cuma memanggil menu — yang berpindah halaman
    // tinggal usapan dan tombol.
    if (!props.tapZones) {
      emit('menu')
      return
    }
    if (ratio < 0.33) left()
    else if (ratio > 0.67) right()
    else emit('menu')
  },
  onSwipe(direction) {
    // Usapan ke kiri menggeser halaman ke kiri keluar layar, artinya yang datang
    // adalah halaman di sebelah kanan.
    if (direction === 'left') right()
    else left()
  },
})

// Zoom melekat pada halaman, bukan pada sesi baca: halaman baru selalu mulai
// dari 1×. Kalau tidak, berpindah halaman dalam keadaan diperbesar mendaratkan
// pembacanya di potongan acak gambar berikutnya.
watch(() => props.index, reset)

/** Halaman yang ikut dipasang: yang sedang dibaca, satu sebelumnya, N sesudahnya. */
const nearby = computed(() => {
  const first = Math.max(props.index - 1, 0)
  const last = Math.min(props.index + Math.max(props.preload, 0), props.pages.length - 1)
  return props.pages.slice(first, last + 1)
})
</script>

<template>
  <div
    class="relative flex h-dvh w-full touch-pan-y items-center justify-center overflow-hidden bg-black"
    :class="zoomed ? 'cursor-grab' : ''"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      v-for="page in nearby"
      v-show="page.index === index"
      :key="page.url"
      class="flex max-h-dvh w-full items-center justify-center overflow-hidden"
      :style="page.index === index ? style : undefined"
    >
      <ReaderImage
        :src="page.url"
        :alt="t('reader.page', { number: page.index + 1 })"
        :fit="fit"
        :eager="page.index === index"
      />
    </div>

    <p
      v-if="zoomed"
      class="pointer-events-none absolute bottom-4 right-4 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
    >
      {{ scale.toFixed(1) }}×
    </p>
  </div>
</template>
