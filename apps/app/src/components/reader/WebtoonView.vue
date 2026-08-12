<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ReaderImage from './ReaderImage.vue'
import type { ReaderPage } from '@/services/reader.service'

/**
 * Mode gulir menerus — bentuk manhwa/manhua yang satu chapternya potongan
 * gambar panjang tanpa batas halaman.
 *
 * Halaman "sekarang" di sini tidak ditentukan oleh ketukan melainkan oleh apa
 * yang sedang dilihat, dan itu dibaca lewat `IntersectionObserver` dengan
 * `rootMargin` yang menyisakan pita tipis di tengah layar. Alternatifnya —
 * menghitung `scrollTop` setiap frame — memaksa layout dibaca ulang terus
 * menerus dan membuat gulirnya tersendat justru di perangkat yang paling butuh
 * mulus.
 */
const props = defineProps<{
  pages: ReaderPage[]
  index: number
  preload: number
  tapZones: boolean
}>()

const emit = defineEmits<{
  'update:index': [value: number]
  reachEnd: []
  menu: []
}>()

const scroller = ref<HTMLElement | null>(null)
const items = ref<HTMLElement[]>([])
const end = ref<HTMLElement | null>(null)

/**
 * Menahan pengamat selagi posisi awal dipulihkan. Tanpa ini, melompat ke
 * halaman 20 melewati halaman 1–19 dan masing-masing sempat melapor sebagai
 * "sedang dibaca" — progresnya tertulis mundur ke nol.
 */
let restoring = true

/**
 * Sudah pernah digulir pengguna.
 *
 * Selama gambar berdatangan, tinggi tiap potongan berubah dan pita tengah bisa
 * berpindah ke halaman lain tanpa satu pun jari menyentuh layar — chapter yang
 * baru dibuka tiba-tiba tercatat di halaman tiga, dan waktu ditutup lalu dibuka
 * lagi tidak mendarat di tempat yang ditinggalkan. Posisi baru boleh ditulis
 * setelah benar-benar ada gulir; sebelum itu yang berlaku tetap posisi tersimpan.
 */
let scrolled = false

let observer: IntersectionObserver | null = null
let tail: IntersectionObserver | null = null

function setItem(el: unknown, at: number): void {
  if (el instanceof HTMLElement) items.value[at] = el
}

function observe(): void {
  observer?.disconnect()
  tail?.disconnect()

  observer = new IntersectionObserver(
    (entries) => {
      if (restoring || !scrolled) return
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const at = items.value.indexOf(entry.target as HTMLElement)
        if (at >= 0 && at !== props.index) emit('update:index', at)
      }
    },
    // Pita 10% di tengah layar: praktis cuma satu gambar yang memenuhinya.
    { root: scroller.value, rootMargin: '-45% 0px -45% 0px', threshold: 0 },
  )
  for (const el of items.value) if (el) observer.observe(el)

  // Penjaga terpisah untuk ujung chapter. Gambar terakhir sebuah webtoon sering
  // lebih pendek dari setengah layar dan tidak pernah melewati pita tengah,
  // jadi tanpa sensor di dasar halaman chapternya tidak akan pernah bertanda
  // selesai walau jelas sudah dibaca habis.
  tail = new IntersectionObserver(
    (entries) => {
      if (restoring) return
      if (entries.some((entry) => entry.isIntersecting)) emit('reachEnd')
    },
    { root: scroller.value, threshold: 0 },
  )
  if (end.value) tail.observe(end.value)
}

/**
 * Menggulir ke awal sebuah halaman — dipakai saat melanjutkan bacaan, dan juga
 * saat membuka dari halaman pertama.
 *
 * Dipanggil juga untuk `at === 0` yang tidak menggulir ke mana-mana, karena yang
 * dibutuhkan bukan gulirnya melainkan jeda `restoring`-nya: sebelum gambar
 * pertama punya tinggi sungguhan, beberapa pengganti sekaligus melewati pita
 * tengah dan salah satunya melapor sebagai halaman yang sedang dibaca —
 * chapter yang baru dibuka langsung tercatat di halaman tiga.
 */
async function jumpTo(at: number): Promise<void> {
  restoring = true
  await nextTick()
  items.value[at]?.scrollIntoView({ block: 'start' })
  // Satu frame tidak cukup: gambar di atasnya masih memuat dan tingginya
  // berubah, yang menggeser sasaran. Diulang sekali setelah jeda pendek.
  window.setTimeout(() => {
    items.value[at]?.scrollIntoView({ block: 'start' })
    restoring = false
  }, 400)
}

/** Gulir dari pengguna maupun dari tombol; keduanya sama-sama disengaja. */
function onScroll(): void {
  if (!restoring) scrolled = true
}

/** Titik jari saat menyentuh, untuk memisahkan ketukan dari gulir. */
let touch: { x: number; y: number } | null = null

function onPointerDown(event: PointerEvent): void {
  touch = { x: event.clientX, y: event.clientY }
}

function onTap(event: PointerEvent): void {
  const start = touch
  touch = null
  const target = event.currentTarget
  if (!(target instanceof HTMLElement) || !start) return

  // Melepas jari setelah menggulir bukan ketukan. Tanpa ambang ini, setiap
  // gulir pendek berakhir dengan menu yang berkedip muncul.
  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return

  const height = target.clientHeight
  if (!props.tapZones || height === 0) {
    emit('menu')
    return
  }

  // Di mode gulir, sisi layar tidak menggeser halaman melainkan menggulir satu
  // layar — sepertiga atas naik, sepertiga bawah turun.
  const ratio = (event.clientY - target.getBoundingClientRect().top) / height
  if (ratio < 0.3) scrollBy(-1)
  else if (ratio > 0.7) scrollBy(1)
  else emit('menu')
}

function scrollBy(direction: 1 | -1): void {
  const el = scroller.value
  if (!el) return
  // Menyisakan 10% tumpang tindih supaya baris yang terpotong di tepi layar
  // tidak terlewat.
  el.scrollBy({ top: direction * el.clientHeight * 0.9, behavior: 'smooth' })
}

onMounted(async () => {
  await nextTick()
  observe()
  await jumpTo(props.index)
})

// Daftar halaman berganti berarti chapternya berganti: pengamat dipasang ulang
// pada elemen yang baru.
watch(
  () => props.pages,
  async () => {
    items.value = []
    scrolled = false
    await nextTick()
    observe()
    await jumpTo(props.index)
  },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  tail?.disconnect()
})

// Dipakai halaman reader untuk papan ketik: panah dan spasi harus menggulir
// wadah ini, bukan dokumen di belakangnya.
defineExpose({ jumpTo, scrollBy })
</script>

<template>
  <div
    ref="scroller"
    class="h-dvh w-full overflow-y-auto overscroll-contain bg-black"
    @scroll.passive="onScroll"
    @pointerdown="onPointerDown"
    @pointerup="onTap"
  >
    <div class="mx-auto max-w-3xl">
      <div v-for="(page, at) in pages" :key="page.url" :ref="(el) => setItem(el, at)">
        <ReaderImage
          :src="page.url"
          :alt="`Halaman ${page.index + 1}`"
          fit="width"
          :eager="at <= index + preload"
        />
      </div>

      <!-- Sensor ujung chapter; tingginya cukup untuk terlihat sebelum gulir
           benar-benar mentok. -->
      <div ref="end" class="h-16" />
    </div>
  </div>
</template>
