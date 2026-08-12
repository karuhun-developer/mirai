<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  PictureInPicture2,
  Play,
  Settings2,
  SkipForward,
  X,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/services/playback'

/**
 * Bilah kendali pemutar.
 *
 * Menutupi videonya, jadi isinya dibatasi pada yang benar-benar dipakai sambil
 * menonton. Komponennya tidak menyimpan keadaan apa pun: semua angka datang
 * sebagai prop dan setiap tombol cuma memancarkan niat — supaya kendali dari
 * papan ketik dan dari layar sentuh menempuh jalan yang sama persis.
 */
defineProps<{
  title: string
  episode: string
  /** Nomor urut episode di antara semuanya, untuk "3 dari 12". */
  position: number
  totalItems: number
  currentTime: number
  duration: number
  playing: boolean
  buffering: boolean
  quality: string
  /** Berapa detik dilompati tombol lewati intro. */
  skipSeconds: number
  hasPrevious: boolean
  hasNext: boolean
  canPip: boolean
}>()

const emit = defineEmits<{
  close: []
  toggle: []
  seek: [seconds: number]
  skip: []
  previous: []
  next: []
  settings: []
  pip: []
}>()

function onSeek(event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement) emit('seek', Number(target.value))
}
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between">
    <header
      class="pointer-events-auto flex items-center gap-2 bg-gradient-to-b from-black/85 to-transparent px-2 py-2 pt-safe text-white"
    >
      <Button
        variant="ghost"
        size="icon"
        class="text-white"
        aria-label="Tutup"
        @click="emit('close')"
      >
        <X />
      </Button>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ title }}</p>
        <p class="truncate text-xs text-white/70">
          {{ episode }}
          <span v-if="totalItems > 0"> · {{ position }} dari {{ totalItems }}</span>
        </p>
      </div>

      <Button
        v-if="canPip"
        variant="ghost"
        size="icon"
        class="text-white"
        aria-label="Layar kecil"
        @click="emit('pip')"
      >
        <PictureInPicture2 />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        class="text-white"
        aria-label="Setelan pemutar"
        data-testid="player-settings-open"
        @click="emit('settings')"
      >
        <Settings2 />
      </Button>
    </header>

    <!-- Tombol putar di tengah: sasaran terbesar dan paling sering ditekan. -->
    <div class="pointer-events-none flex flex-1 items-center justify-center">
      <Button
        variant="ghost"
        size="icon"
        class="pointer-events-auto size-16 rounded-full bg-black/40 text-white disabled:opacity-100"
        :disabled="buffering"
        :aria-label="playing ? 'Jeda' : 'Putar'"
        data-testid="player-toggle"
        @click="emit('toggle')"
      >
        <span
          v-if="buffering"
          class="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white"
        />
        <Pause v-else-if="playing" class="size-8" />
        <Play v-else class="size-8" />
      </Button>
    </div>

    <footer
      class="pointer-events-auto space-y-1 bg-gradient-to-t from-black/85 to-transparent px-2 py-2 pb-safe text-white"
    >
      <input
        type="range"
        class="h-1 w-full accent-primary"
        min="0"
        :max="Math.max(duration, 0)"
        step="1"
        :value="currentTime"
        :disabled="duration <= 0"
        aria-label="Geser posisi tonton"
        data-testid="player-seek"
        @input="onSeek"
      />

      <div class="flex items-center gap-1">
        <span class="text-xs tabular-nums text-white/70" data-testid="player-time">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </span>

        <span class="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          class="text-white"
          :aria-label="`Lewati ${skipSeconds} detik`"
          data-testid="player-skip"
          @click="emit('skip')"
        >
          <SkipForward />
          +{{ skipSeconds }}s
        </Button>

        <Button
          variant="ghost"
          size="sm"
          class="text-white"
          aria-label="Ganti kualitas"
          data-testid="player-quality"
          @click="emit('settings')"
        >
          {{ quality || 'Kualitas' }}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          class="text-white disabled:opacity-30"
          :disabled="!hasPrevious"
          aria-label="Episode sebelumnya"
          @click="emit('previous')"
        >
          <ChevronLeft />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          class="text-white disabled:opacity-30"
          :disabled="!hasNext"
          aria-label="Episode berikutnya"
          data-testid="player-next"
          @click="emit('next')"
        >
          <ChevronRight />
        </Button>
      </div>
    </footer>
  </div>
</template>
