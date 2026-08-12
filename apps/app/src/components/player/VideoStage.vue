<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { attachVideo, type AttachedVideo } from '@/services/hls.service'
import type { PlayableVideo } from '@/services/playback'
import type { PlayerTrack } from '@/stores/player'

/**
 * Elemen `<video>` beserta segala yang menempel padanya.
 *
 * Satu-satunya komponen yang boleh menyentuh elemen video. Store menyimpan
 * *angka* (detik, durasi, sedang jalan atau tidak), komponen ini menyimpan
 * *elemennya* — pemisahan itu yang membuat berganti kualitas cukup mengganti
 * sumber tanpa store perlu tahu ada elemen DOM sama sekali.
 */
const props = defineProps<{
  video: PlayableVideo | null
  /** Detik yang harus dipasang begitu metadata siap; -1 berarti tidak ada. */
  resumeTo: number
  track: PlayerTrack | null
  speed: number
  volume: number
}>()

const emit = defineEmits<{
  time: [seconds: number, duration: number]
  playing: [value: boolean]
  buffering: [value: boolean]
  resumed: []
  ended: []
  error: [message: string]
  toggle: []
}>()

const el = ref<HTMLVideoElement | null>(null)
let attached: AttachedVideo | null = null

/**
 * Sumber diganti tiap kali pilihan video berubah. `flush: 'post'` supaya
 * elemennya sudah ada di DOM waktu pemasangan pertama dijalankan.
 */
watch(
  () => props.video,
  async (video) => {
    attached?.detach()
    attached = null

    const element = el.value
    // Tipe `embed` tidak punya berkas video; halamannya yang menampilkan tautan.
    if (!element || !video || video.type === 'embed') return

    attached = await attachVideo(element, video, (message) => emit('error', message))
    element.playbackRate = props.speed
    element.volume = props.volume
  },
  { immediate: true, flush: 'post' },
)

watch(
  () => props.speed,
  (value) => {
    if (el.value) el.value.playbackRate = value
  },
)

watch(
  () => props.volume,
  (value) => {
    if (el.value) el.value.volume = value
  },
)

/**
 * Takarir yang dipasang cuma satu — yang sedang aktif. Menjejalkan semuanya
 * sekaligus lalu mengatur `mode` per track terdengar lebih rapi, tapi tiap
 * browser punya kebiasaan berbeda soal kapan `mode` boleh diubah, dan hasilnya
 * takarir yang kadang muncul kadang tidak.
 */
watch(
  () => props.track?.src,
  () => {
    const element = el.value
    if (!element) return
    // Track baru butuh satu putaran DOM sebelum masuk `textTracks`.
    requestAnimationFrame(() => {
      const first = element.textTracks[0]
      if (first) first.mode = 'showing'
    })
  },
  { flush: 'post' },
)

function onLoadedMetadata(): void {
  const element = el.value
  if (!element) return

  if (props.resumeTo > 0) {
    element.currentTime = props.resumeTo
    emit('resumed')
  }

  emit('time', element.currentTime, element.duration)
  // Ditolak browser kalau belum ada gestur pengguna di halaman ini. Bukan
  // kegagalan: tombol putar tetap ada, dan pesan error malah membingungkan.
  void element.play().catch(() => {})
}

function onTimeUpdate(): void {
  const element = el.value
  if (element) emit('time', element.currentTime, element.duration)
}

function onError(): void {
  const code = el.value?.error?.code
  emit(
    'error',
    code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
      ? 'Format video ini tidak didukung browser. Coba host atau kualitas lain.'
      : 'Video berhenti karena kesalahan pemutaran. Coba host atau kualitas lain.',
  )
}

/** Dipakai halaman untuk tombol putar, geser, lewati intro, dan PiP. */
defineExpose({
  play: (): void => void el.value?.play().catch(() => {}),
  pause: (): void => el.value?.pause(),
  seek: (seconds: number): void => {
    const element = el.value
    if (!element) return
    element.currentTime = Math.max(0, Math.min(seconds, element.duration || seconds))
    emit('time', element.currentTime, element.duration)
  },
  async togglePip(): Promise<void> {
    const element = el.value
    if (!element || !document.pictureInPictureEnabled) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await element.requestPictureInPicture()
    } catch {
      // Ditolak perangkat atau kebijakan browser; menonton biasa tetap jalan.
    }
  },
})

onBeforeUnmount(() => {
  attached?.detach()
  attached = null
})
</script>

<template>
  <video
    ref="el"
    class="h-full w-full bg-black"
    data-testid="player-video"
    playsinline
    preload="metadata"
    @click="emit('toggle')"
    @loadedmetadata="onLoadedMetadata"
    @timeupdate="onTimeUpdate"
    @play="emit('playing', true)"
    @pause="emit('playing', false)"
    @waiting="emit('buffering', true)"
    @playing="emit('buffering', false)"
    @canplay="emit('buffering', false)"
    @ended="emit('ended')"
    @error="onError"
  >
    <track
      v-if="track?.src"
      :key="track.src"
      kind="subtitles"
      :src="track.src"
      :label="track.label"
      :srclang="track.lang ?? 'und'"
      default
    />
  </video>
</template>
