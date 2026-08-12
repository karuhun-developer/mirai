<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { ArrowLeft, ExternalLink, LoaderCircle } from '@lucide/vue'
import ChallengeNotice from '@/components/common/ChallengeNotice.vue'
import PlayerControls from '@/components/player/PlayerControls.vue'
import PlayerSettings from '@/components/player/PlayerSettings.vue'
import VideoStage from '@/components/player/VideoStage.vue'
import { Button } from '@/components/ui/button'
import { entryLocation, playerLocation } from '@/router/links'
import {
  enterFullscreen,
  exitFullscreen,
  lockOrientation,
  unlockOrientation,
} from '@/services/screen.service'
import { useExtensionsStore } from '@/stores/extensions'
import { usePlayerStore } from '@/stores/player'

/**
 * Halaman tonton.
 *
 * Sama pembagian perannya dengan reader: store memegang data dan aturannya,
 * `VideoStage` memegang elemen videonya, dan halaman ini cuma menyambungkan
 * keduanya dengan layar perangkat, papan ketik, dan navigasi antar-episode.
 */
const route = useRoute()
const router = useRouter()
const store = usePlayerStore()
const extensions = useExtensionsStore()

const itemId = computed(() => String(route.params['itemId'] ?? ''))
const native = Capacitor.isNativePlatform()
const canPip = typeof document !== 'undefined' && document.pictureInPictureEnabled

const stage = ref<InstanceType<typeof VideoStage> | null>(null)
const controls = ref(true)
const settings = ref(false)

let hideTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Kendali menghilang sendiri setelah tiga detik sementara video berjalan, dan
 * tetap tampil selama video dijeda: layar yang gelap total tanpa satu pun tombol
 * membuat orang menebak cara keluarnya, tapi bilah yang menetap menutupi
 * takarir.
 */
function flashControls(): void {
  controls.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    hideTimer = null
    if (store.playing) controls.value = false
  }, 3000)
}

function toggleControls(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (controls.value) controls.value = false
  else flashControls()
}

async function load(): Promise<void> {
  await extensions.ensureLoaded()
  await store.open(itemId.value, (id) => extensions.byId(id))
  flashControls()
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

/** Laporan posisi dari elemen video; penjarangan penulisannya urusan store. */
function onTime(seconds: number, duration: number): void {
  void store.report(seconds, duration)
}

function togglePlay(): void {
  if (store.playing) stage.value?.pause()
  else stage.value?.play()
  flashControls()
}

function seek(seconds: number): void {
  stage.value?.seek(seconds)
  flashControls()
}

/** Lompat maju sepanjang setelan — biasanya untuk melewati opening. */
function skip(): void {
  seek(store.currentTime + store.prefs.skipSeconds)
}

/** Pindah episode mengganti alamat, bukan menumpuknya (sama seperti reader). */
async function goToItem(id: string | undefined): Promise<void> {
  if (!id) return
  await router.replace(playerLocation(id))
}

/** Keluar ke halaman detail judulnya. */
async function leave(): Promise<void> {
  await store.close()
  const entry = store.entry
  if (entry) await router.push(entryLocation(entry.kind, entry.source_id, entry.url))
  else router.back()
}

/**
 * Episode habis. Menandai selesai selalu; lanjut sendiri cuma kalau disetel dan
 * memang ada episode berikutnya — kalau tidak, kendali dimunculkan lagi supaya
 * layar tidak diam tanpa penjelasan.
 */
async function onEnded(): Promise<void> {
  await store.finish()
  if (store.prefs.autoplayNext && store.next) await goToItem(store.next.id)
  else flashControls()
}

function onKey(event: KeyboardEvent): void {
  if (event.defaultPrevented) return

  switch (event.key) {
    case ' ':
    case 'k':
      event.preventDefault()
      togglePlay()
      break
    case 'ArrowRight':
      seek(store.currentTime + 10)
      break
    case 'ArrowLeft':
      seek(store.currentTime - 10)
      break
    case 's':
      skip()
      break
    case 'n':
      void goToItem(store.next?.id)
      break
    case 'p':
      void goToItem(store.previous?.id)
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

// Tombol episode berikutnya cuma mengganti parameter rute; komponennya tidak
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
  <div class="fixed inset-0 bg-black text-white" data-testid="player">
    <VideoStage
      v-if="store.hasVideo && !store.isEmbed"
      ref="stage"
      class="h-dvh w-full"
      :video="store.current"
      :resume-to="store.resumeTo"
      :track="store.activeTrack"
      :speed="store.prefs.speed"
      :volume="store.prefs.volume"
      @time="onTime"
      @playing="store.playing = $event"
      @buffering="store.buffering = $event"
      @resumed="store.resumeTo = -1"
      @ended="onEnded()"
      @error="store.error = $event"
      @toggle="toggleControls()"
    />

    <div v-if="store.loading" class="grid h-dvh place-items-center">
      <LoaderCircle class="size-8 animate-spin text-white/60" />
    </div>

    <!-- Host yang cuma memberi halaman player pihak ketiga. Tidak ada berkas
         video yang bisa dipasang, jadi satu-satunya yang jujur adalah membuka
         halamannya di luar app. -->
    <div
      v-else-if="store.isEmbed"
      class="grid h-dvh place-content-center gap-3 px-6 text-center"
      data-testid="player-embed"
    >
      <p class="text-sm text-white/80">
        Host ini ({{ store.current?.quality }}) cuma menyediakan halaman pemutarnya sendiri, bukan
        berkas video. Bukalah di peramban, atau pilih host lain dari setelan.
      </p>
      <div class="flex justify-center gap-2">
        <Button variant="secondary" size="sm" as="a" :href="store.current?.url" target="_blank">
          <ExternalLink />
          Buka di peramban
        </Button>
        <Button variant="ghost" size="sm" class="text-white" @click="settings = true">
          Pilih host lain
        </Button>
      </div>
    </div>

    <!-- Gagal memuat: seluruh layar dipakai menjelaskannya, bukan sepotong
         pesan di atas layar hitam. -->
    <div
      v-else-if="!store.hasVideo"
      class="grid h-dvh place-content-center gap-3 overflow-y-auto px-6 py-10 text-center"
    >
      <ChallengeNotice
        v-if="store.challenge"
        class="text-left text-foreground"
        :challenge="store.challenge"
        :source-name="store.entry?.title ?? 'Sumber ini'"
      />
      <p v-else class="text-sm text-white/80">
        {{ store.error ?? 'Episode ini tidak punya video yang bisa diputar.' }}
      </p>

      <div class="flex justify-center gap-2">
        <Button variant="secondary" size="sm" @click="load()">Coba lagi</Button>
        <Button variant="ghost" size="sm" class="text-white" @click="leave()">
          <ArrowLeft />
          Kembali
        </Button>
      </div>
    </div>

    <!-- Pesan yang datang saat video sudah jalan (takarir gagal, segmen putus)
         tidak boleh menghapus videonya; cukup lewat di atasnya. -->
    <p
      v-if="store.error && store.hasVideo"
      class="pointer-events-none fixed inset-x-4 top-20 z-40 rounded-md bg-black/80 px-3 py-2 text-center text-xs text-white"
    >
      {{ store.error }}
    </p>

    <PlayerControls
      v-if="controls && store.hasVideo && !store.isEmbed"
      :title="store.entry?.title ?? ''"
      :episode="store.item?.name ?? ''"
      :position="store.position"
      :total-items="store.totalItems"
      :current-time="store.currentTime"
      :duration="store.duration"
      :playing="store.playing"
      :buffering="store.buffering"
      :quality="store.current?.quality ?? ''"
      :skip-seconds="store.prefs.skipSeconds"
      :has-previous="store.previous !== null"
      :has-next="store.next !== null"
      :can-pip="canPip"
      @close="leave()"
      @toggle="togglePlay()"
      @seek="seek($event)"
      @skip="skip()"
      @previous="goToItem(store.previous?.id)"
      @next="goToItem(store.next?.id)"
      @settings="settings = true"
      @pip="stage?.togglePip()"
    />

    <PlayerSettings
      v-if="settings"
      :prefs="store.prefs"
      :videos="store.videos"
      :video-index="store.videoIndex"
      :tracks="store.tracks"
      :track-index="store.trackIndex"
      :native="native"
      @update="updatePrefs($event)"
      @select-video="store.selectVideo($event)"
      @select-track="store.selectTrack($event)"
      @close="settings = false"
    />
  </div>
</template>
