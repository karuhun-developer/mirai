<script setup lang="ts">
import { Switch } from '@/components/ui/switch'
import type { PageFit, ReaderPrefs, ReadingMode } from '@/services/reader.service'

/**
 * Panel setelan reader.
 *
 * Semuanya berlaku seketika dan tersimpan global (bukan per judul): pembaca
 * manga cenderung punya satu kebiasaan — kanan-ke-kiri untuk manga Jepang atau
 * gulir menerus untuk manhwa — dan menyetel ulang tiap membuka judul baru cuma
 * merepotkan. Kalau nanti terbukti perlu per judul, kuncinya tinggal ditambah
 * di `reader.service`.
 */
defineProps<{
  prefs: ReaderPrefs
  /** Kunci orientasi cuma nyata di APK; di web tombolnya dimatikan. */
  native: boolean
}>()

const emit = defineEmits<{
  update: [patch: Partial<ReaderPrefs>]
  close: []
}>()

const modes: { value: ReadingMode; label: string }[] = [
  { value: 'ltr', label: 'Kiri → kanan' },
  { value: 'rtl', label: 'Kanan → kiri' },
  { value: 'webtoon', label: 'Gulir (webtoon)' },
]

const fits: { value: PageFit; label: string }[] = [
  { value: 'width', label: 'Lebar' },
  { value: 'height', label: 'Tinggi' },
  { value: 'contain', label: 'Muat layar' },
]

const orientations: { value: ReaderPrefs['orientation']; label: string }[] = [
  { value: 'free', label: 'Bebas' },
  { value: 'portrait', label: 'Tegak' },
  { value: 'landscape', label: 'Rebah' },
]

const preloads = [0, 2, 3, 5, 8]
</script>

<template>
  <!-- Latar gelap menutup panel; klik di panelnya sendiri tidak boleh menembus. -->
  <div class="fixed inset-0 z-40 flex items-end justify-center bg-black/60" @click="emit('close')">
    <div
      class="w-full max-w-md space-y-4 rounded-t-2xl bg-background p-4 pb-safe md:mb-6 md:rounded-2xl"
      @click.stop
    >
      <div class="mx-auto h-1 w-10 rounded-full bg-border" />

      <section class="space-y-2">
        <p class="text-sm font-medium">Mode baca</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="mode in modes"
            :key="mode.value"
            type="button"
            class="rounded-md px-2 py-2 text-xs"
            :class="
              prefs.mode === mode.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            "
            @click="emit('update', { mode: mode.value })"
          >
            {{ mode.label }}
          </button>
        </div>
      </section>

      <!-- Gulir menerus selalu selebar layar; pilihan muat lain tidak berlaku. -->
      <section v-if="prefs.mode !== 'webtoon'" class="space-y-2">
        <p class="text-sm font-medium">Ukuran halaman</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="fit in fits"
            :key="fit.value"
            type="button"
            class="rounded-md px-2 py-2 text-xs"
            :class="
              prefs.fit === fit.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            "
            @click="emit('update', { fit: fit.value })"
          >
            {{ fit.label }}
          </button>
        </div>
      </section>

      <section class="space-y-2">
        <p class="text-sm font-medium">Halaman disiapkan di depan</p>
        <div class="flex gap-2">
          <button
            v-for="value in preloads"
            :key="value"
            type="button"
            class="flex-1 rounded-md px-2 py-2 text-xs tabular-nums"
            :class="
              prefs.preload === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            "
            @click="emit('update', { preload: value })"
          >
            {{ value }}
          </button>
        </div>
        <p class="text-xs text-muted-foreground">
          Makin banyak makin mulus, tapi makin boros kuota — halaman yang tidak jadi dibaca tetap
          terunduh.
        </p>
      </section>

      <label class="flex items-center justify-between gap-4">
        <span class="min-w-0">
          <span class="block text-sm font-medium">Ketuk sisi layar</span>
          <span class="block text-xs text-muted-foreground">
            Sisi kiri dan kanan berpindah halaman; tengah membuka menu.
          </span>
        </span>
        <Switch
          :model-value="prefs.tapZones"
          @update:model-value="emit('update', { tapZones: $event })"
        />
      </label>

      <label class="flex items-center justify-between gap-4">
        <span class="min-w-0">
          <span class="block text-sm font-medium">Layar penuh</span>
          <span class="block text-xs text-muted-foreground">
            Menyembunyikan bilah sistem selama membaca.
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
        @click="emit('close')"
      >
        Tutup setelan
      </button>
    </div>
  </div>
</template>
