<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { ArrowLeft, LoaderCircle } from '@lucide/vue'
import ChallengeNotice from '@/components/common/ChallengeNotice.vue'
import PagedView from '@/components/reader/PagedView.vue'
import ReaderMenu from '@/components/reader/ReaderMenu.vue'
import ReaderSettings from '@/components/reader/ReaderSettings.vue'
import WebtoonView from '@/components/reader/WebtoonView.vue'
import { Button } from '@/components/ui/button'
import { entryLocation, readerLocation } from '@/router/links'
import {
  enterFullscreen,
  exitFullscreen,
  lockOrientation,
  unlockOrientation,
} from '@/services/screen.service'
import { useExtensionsStore } from '@/stores/extensions'
import { useReaderStore } from '@/stores/reader'

/**
 * Halaman baca.
 *
 * Perannya menyambungkan tiga hal yang sengaja tidak saling kenal: store (posisi
 * dan progres), komponen tampilan (paged/webtoon), dan layar perangkat
 * (fullscreen + orientasi). Aturan yang menyangkut data — kapan chapter dianggap
 * selesai, di halaman berapa melanjutkan — semuanya di store, bukan di sini.
 */
const route = useRoute()
const router = useRouter()
const store = useReaderStore()
const extensions = useExtensionsStore()

const itemId = computed(() => String(route.params['itemId'] ?? ''))
const native = Capacitor.isNativePlatform()

const menu = ref(true)
const settings = ref(false)
const webtoonRef = ref<InstanceType<typeof WebtoonView> | null>(null)

let hideTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Menu tampil sebentar setiap chapter dibuka. Reader yang langsung gelap total
 * tanpa satu pun tombol membuat orang menebak-nebak cara keluarnya; dua setengah
 * detik cukup untuk terlihat, belum cukup untuk mengganggu.
 */
function flashMenu(): void {
  menu.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    hideTimer = null
    menu.value = false
  }, 2500)
}

function toggleMenu(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  menu.value = !menu.value
}

async function load(): Promise<void> {
  await extensions.ensureLoaded()
  await store.open(itemId.value, (id) => extensions.byId(id))
  flashMenu()
  await applyScreen()
}

/** Layar penuh dan kunci orientasi mengikuti setelan; keduanya boleh gagal. */
async function applyScreen(): Promise<void> {
  if (store.prefs.fullscreen) await enterFullscreen()
  else await exitFullscreen()

  if (store.prefs.orientation === 'free') await unlockOrientation()
  else await lockOrientation(store.prefs.orientation)
}

async function updatePrefs(patch: Partial<typeof store.prefs>): Promise<void> {
  await store.setPrefs(patch)
  await applyScreen()
}

/** Pindah chapter mengganti alamat, bukan menumpuknya: tombol kembali tetap
 *  mengembalikan ke halaman detail, bukan menelusuri chapter satu per satu. */
async function goToItem(id: string | undefined): Promise<void> {
  if (!id) return
  await router.replace(readerLocation(id))
}

/** Keluar ke halaman detail judulnya. */
async function leave(): Promise<void> {
  await store.close()
  const entry = store.entry
  if (entry) await router.push(entryLocation(entry.kind, entry.source_id, entry.url))
  else router.back()
}

function onKey(event: KeyboardEvent): void {
  if (event.defaultPrevented) return

  switch (event.key) {
    case 'ArrowRight':
      void (store.rightToLeft ? store.backward() : store.forward())
      break
    case 'ArrowLeft':
      void (store.rightToLeft ? store.forward() : store.backward())
      break
    case 'ArrowDown':
    case 'PageDown':
    case ' ':
      // Di mode gulir panah bawah menggulir, bukan melompati halaman: gambar
      // webtoon jauh lebih tinggi dari layar dan melompat berarti melewatkan
      // sebagian besar isinya.
      if (store.webtoon) {
        event.preventDefault()
        webtoonRef.value?.scrollBy(1)
      } else void store.forward()
      break
    case 'ArrowUp':
    case 'PageUp':
      if (store.webtoon) {
        event.preventDefault()
        webtoonRef.value?.scrollBy(-1)
      } else void store.backward()
      break
    case 'm':
      toggleMenu()
      break
    case 'Escape':
      void leave()
      break
    default:
      break
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  void load()
})

// Tombol chapter berikutnya cuma mengganti parameter rute; komponennya tidak
// di-mount ulang, jadi pemuatannya harus dipicu dari sini.
watch(itemId, (value) => {
  if (value) void load()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (hideTimer) clearTimeout(hideTimer)
  void store.close()
  void exitFullscreen()
  void unlockOrientation()
})
</script>

<template>
  <div class="fixed inset-0 bg-black text-white" data-testid="reader">
    <PagedView
      v-if="store.hasPages && !store.webtoon"
      :pages="store.pages"
      :index="store.index"
      :fit="store.prefs.fit"
      :preload="store.prefs.preload"
      :tap-zones="store.prefs.tapZones"
      :right-to-left="store.rightToLeft"
      @forward="store.forward()"
      @backward="store.backward()"
      @menu="toggleMenu"
    />

    <WebtoonView
      v-else-if="store.hasPages"
      ref="webtoonRef"
      :pages="store.pages"
      :index="store.index"
      :preload="store.prefs.preload"
      :tap-zones="store.prefs.tapZones"
      @update:index="store.goTo($event)"
      @reach-end="store.finish()"
      @menu="toggleMenu"
    />

    <div v-if="store.loading" class="grid h-dvh place-items-center gap-2 text-center">
      <LoaderCircle class="size-8 animate-spin text-white/60" />
    </div>

    <!-- Gagal memuat halaman: tidak ada yang bisa dibaca, jadi seluruh layar
         dipakai untuk menjelaskannya, bukan sepotong pesan di atas layar hitam. -->
    <div
      v-else-if="!store.hasPages"
      class="grid h-dvh place-content-center gap-3 overflow-y-auto px-6 py-10 text-center"
    >
      <template v-if="store.challenge">
        <ChallengeNotice
          class="text-left text-foreground"
          :challenge="store.challenge"
          :source-name="store.entry?.title ?? 'Sumber ini'"
        />
      </template>

      <template v-else>
        <p class="text-sm text-white/80" data-testid="reader-error">
          {{ store.error ?? 'Chapter ini tidak punya halaman yang bisa ditampilkan.' }}
        </p>
      </template>

      <div class="flex justify-center gap-2">
        <Button variant="secondary" size="sm" @click="load()">Coba lagi</Button>
        <Button variant="ghost" size="sm" class="text-white" @click="leave()">
          <ArrowLeft />
          Kembali
        </Button>
      </div>
    </div>

    <ReaderMenu
      v-if="menu"
      :title="store.entry?.title ?? ''"
      :chapter="store.item?.name ?? ''"
      :position="store.position"
      :total-items="store.totalItems"
      :page="store.humanPage"
      :total="store.total"
      :index="store.index"
      :right-to-left="store.rightToLeft"
      :has-previous="store.previous !== null"
      :has-next="store.next !== null"
      @close="leave()"
      @seek="store.goTo($event)"
      @previous="goToItem(store.previous?.id)"
      @next="goToItem(store.next?.id)"
      @settings="settings = true"
    />

    <ReaderSettings
      v-if="settings"
      :prefs="store.prefs"
      :native="native"
      @update="updatePrefs($event)"
      @close="settings = false"
    />
  </div>
</template>
