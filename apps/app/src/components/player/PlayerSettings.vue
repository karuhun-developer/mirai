<script setup lang="ts">
import { Switch } from '@/components/ui/switch'
import type { PlayableVideo } from '@/services/playback'
import type { PlayerPrefs } from '@/services/player.service'
import type { PlayerTrack } from '@/stores/player'

/**
 * Panel setelan pemutar sekaligus pemilih kualitas dan takarir.
 *
 * Digabung jadi satu panel karena ketiganya dibuka dari kebutuhan yang sama —
 * "tontonannya kurang enak" — dan memisahkannya cuma menambah satu ketukan
 * sebelum orang menemukan yang dicarinya. Setelan berlaku global seperti di
 * reader; kualitas dan takarir berlaku untuk episode yang sedang dibuka.
 */
defineProps<{
  prefs: PlayerPrefs
  videos: PlayableVideo[]
  videoIndex: number
  tracks: PlayerTrack[]
  trackIndex: number
  /** Kunci orientasi cuma nyata di APK; di web tombolnya dimatikan. */
  native: boolean
}>()

const emit = defineEmits<{
  update: [patch: Partial<PlayerPrefs>]
  selectVideo: [index: number]
  selectTrack: [index: number]
  close: []
}>()

const speeds = [0.75, 1, 1.25, 1.5, 2]
/** Panjang opening yang lazim; 85 detik jadi bawaan karena paling sering pas. */
const skips = [10, 30, 85, 90]

const orientations: { value: PlayerPrefs['orientation']; label: string }[] = [
  { value: 'free', label: 'Bebas' },
  { value: 'portrait', label: 'Tegak' },
  { value: 'landscape', label: 'Rebah' },
]
</script>

<template>
  <!-- Latar gelap menutup panel; klik di panelnya sendiri tidak boleh menembus. -->
  <div class="fixed inset-0 z-40 flex items-end justify-center bg-black/60" @click="emit('close')">
    <div
      class="max-h-[85dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl bg-background p-4 pb-safe md:mb-6 md:rounded-2xl"
      data-testid="player-settings"
      @click.stop
    >
      <div class="mx-auto h-1 w-10 rounded-full bg-border" />

      <section class="space-y-2">
        <p class="text-sm font-medium">Kualitas &amp; host</p>
        <div class="grid gap-2">
          <button
            v-for="(video, index) in videos"
            :key="`${video.quality}-${index}`"
            type="button"
            class="flex items-center justify-between rounded-md px-3 py-2 text-left text-xs"
            :class="
              videoIndex === index
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            "
            :data-testid="`player-video-${index}`"
            @click="emit('selectVideo', index)"
          >
            <span class="truncate">{{ video.quality }}</span>
            <span class="ml-2 shrink-0 uppercase opacity-70">{{ video.type }}</span>
          </button>
        </div>
        <p class="text-xs text-muted-foreground">
          Berganti kualitas melanjutkan dari posisi yang sama, bukan mengulang dari awal.
        </p>
      </section>

      <section v-if="tracks.length > 0" class="space-y-2">
        <p class="text-sm font-medium">Takarir</p>
        <div class="grid gap-2">
          <button
            type="button"
            class="rounded-md px-3 py-2 text-left text-xs"
            :class="
              trackIndex < 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            "
            @click="emit('selectTrack', -1)"
          >
            Mati
          </button>
          <button
            v-for="(track, index) in tracks"
            :key="track.url"
            type="button"
            class="rounded-md px-3 py-2 text-left text-xs"
            :class="
              trackIndex === index
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            "
            @click="emit('selectTrack', index)"
          >
            {{ track.label }}
          </button>
        </div>
      </section>

      <section class="space-y-2">
        <p class="text-sm font-medium">Kecepatan</p>
        <div class="flex gap-2">
          <button
            v-for="speed in speeds"
            :key="speed"
            type="button"
            class="flex-1 rounded-md px-2 py-2 text-xs tabular-nums"
            :class="
              prefs.speed === speed
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            "
            @click="emit('update', { speed })"
          >
            {{ speed }}×
          </button>
        </div>
      </section>

      <section class="space-y-2">
        <p class="text-sm font-medium">Lompatan tombol lewati</p>
        <div class="flex gap-2">
          <button
            v-for="value in skips"
            :key="value"
            type="button"
            class="flex-1 rounded-md px-2 py-2 text-xs tabular-nums"
            :class="
              prefs.skipSeconds === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            "
            @click="emit('update', { skipSeconds: value })"
          >
            {{ value }}s
          </button>
        </div>
      </section>

      <label class="flex items-center justify-between gap-4">
        <span class="min-w-0">
          <span class="block text-sm font-medium">Lanjut sendiri</span>
          <span class="block text-xs text-muted-foreground">
            Membuka episode berikutnya begitu yang ini habis.
          </span>
        </span>
        <Switch
          :model-value="prefs.autoplayNext"
          @update:model-value="emit('update', { autoplayNext: $event })"
        />
      </label>

      <label class="flex items-center justify-between gap-4">
        <span class="min-w-0">
          <span class="block text-sm font-medium">Takarir menyala</span>
          <span class="block text-xs text-muted-foreground">
            Takarir pertama dipilih otomatis kalau episodenya punya.
          </span>
        </span>
        <Switch
          :model-value="prefs.subtitles"
          @update:model-value="emit('update', { subtitles: $event })"
        />
      </label>

      <label class="flex items-center justify-between gap-4">
        <span class="min-w-0">
          <span class="block text-sm font-medium">Layar penuh</span>
          <span class="block text-xs text-muted-foreground">
            Menyembunyikan bilah sistem selama menonton.
          </span>
        </span>
        <Switch
          :model-value="prefs.fullscreen"
          @update:model-value="emit('update', { fullscreen: $event })"
        />
      </label>

      <section class="space-y-2">
        <p class="text-sm font-medium">Orientasi</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="orientation in orientations"
            :key="orientation.value"
            type="button"
            class="rounded-md px-2 py-2 text-xs disabled:opacity-40"
            :class="
              prefs.orientation === orientation.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            "
            :disabled="!native"
            @click="emit('update', { orientation: orientation.value })"
          >
            {{ orientation.label }}
          </button>
        </div>
        <p v-if="!native" class="text-xs text-muted-foreground">
          Hanya berlaku di aplikasi Android; browser tidak mengizinkan aplikasi mengunci orientasi
          layar.
        </p>
      </section>

      <button
        type="button"
        class="w-full rounded-md bg-secondary py-2 text-sm font-medium"
        data-testid="player-settings-close"
        @click="emit('close')"
      >
        Tutup setelan
      </button>
    </div>
  </div>
</template>
