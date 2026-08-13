<script setup lang="ts">
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()

defineProps<{
  prefs: ReaderPrefs
  /** Kunci orientasi cuma nyata di APK; di web tombolnya dimatikan. */
  native: boolean
}>()

const emit = defineEmits<{
  update: [patch: Partial<ReaderPrefs>]
  close: []
}>()

const modes: { value: ReadingMode; labelKey: string }[] = [
  { value: 'ltr', labelKey: 'reader.modeLtr' },
  { value: 'rtl', labelKey: 'reader.modeRtl' },
  { value: 'webtoon', labelKey: 'reader.modeWebtoon' },
]

const fits: { value: PageFit; labelKey: string }[] = [
  { value: 'width', labelKey: 'reader.fitWidth' },
  { value: 'height', labelKey: 'reader.fitHeight' },
  { value: 'contain', labelKey: 'reader.fitContain' },
]

const orientations: { value: ReaderPrefs['orientation']; labelKey: string }[] = [
  { value: 'free', labelKey: 'reader.orientationFree' },
  { value: 'portrait', labelKey: 'reader.orientationPortrait' },
  { value: 'landscape', labelKey: 'reader.orientationLandscape' },
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
        <p class="text-sm font-medium">{{ t('reader.mode') }}</p>
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
            {{ t(mode.labelKey) }}
          </button>
        </div>
      </section>

      <!-- Gulir menerus selalu selebar layar; pilihan muat lain tidak berlaku. -->
      <section v-if="prefs.mode !== 'webtoon'" class="space-y-2">
        <p class="text-sm font-medium">{{ t('reader.fit') }}</p>
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
            {{ t(fit.labelKey) }}
          </button>
        </div>
      </section>

      <section class="space-y-2">
        <p class="text-sm font-medium">{{ t('reader.preload') }}</p>
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
          {{ t('reader.preloadHint') }}
        </p>
      </section>

      <label class="flex items-center justify-between gap-4">
        <span class="min-w-0">
          <span class="block text-sm font-medium">{{ t('reader.tapZones') }}</span>
          <span class="block text-xs text-muted-foreground">
            {{ t('reader.tapZonesHint') }}
          </span>
        </span>
        <Switch
          :model-value="prefs.tapZones"
          @update:model-value="emit('update', { tapZones: $event })"
        />
      </label>

      <label class="flex items-center justify-between gap-4">
        <span class="min-w-0">
          <span class="block text-sm font-medium">{{ t('reader.fullscreen') }}</span>
          <span class="block text-xs text-muted-foreground">
            {{ t('reader.fullscreenHint') }}
          </span>
        </span>
        <Switch
          :model-value="prefs.fullscreen"
          @update:model-value="emit('update', { fullscreen: $event })"
        />
      </label>

      <section class="space-y-2">
        <p class="text-sm font-medium">{{ t('reader.orientation') }}</p>
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
            {{ t(orientation.labelKey) }}
          </button>
        </div>
        <p v-if="!native" class="text-xs text-muted-foreground">
          {{ t('reader.orientationWebNote') }}
        </p>
      </section>

      <button
        type="button"
        class="w-full rounded-md bg-secondary py-2 text-sm font-medium"
        @click="emit('close')"
      >
        {{ t('reader.closeSettings') }}
      </button>
    </div>
  </div>
</template>
