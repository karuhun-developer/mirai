<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { RotateCw, Trash2 } from '@lucide/vue'
import type { DownloadEntry } from '@mirai/db'
import { Button } from '@/components/ui/button'
import { useCover } from '@/composables/useCover'
import { entryLocation } from '@/router/links'

/**
 * Satu baris antrean unduhan.
 *
 * Beda dari `ItemLine` yang dipakai Updates dan Riwayat karena baris ini punya
 * satu hal yang tidak dimiliki keduanya: **bilah progres**. Untuk pekerjaan yang
 * berjalan menit-menitan, angka persen saja terasa seperti aplikasi yang diam.
 */
const props = defineProps<{ job: DownloadEntry }>()

defineEmits<{ retry: []; remove: [] }>()

const { src, failed } = useCover(() => props.job.entry_thumbnail)
const to = computed(() =>
  entryLocation(props.job.entry_kind, props.job.source_id, props.job.entry_url),
)

const label: Record<DownloadEntry['state'], string> = {
  queued: 'Menunggu giliran',
  running: 'Mengunduh',
  done: 'Tersimpan',
  paused: 'Terjeda',
  failed: 'Gagal',
}

const running = computed(() => props.job.state === 'running')
const failedJob = computed(() => props.job.state === 'failed')

const meta = computed(() => {
  if (failedJob.value) return props.job.error ?? 'Gagal'
  if (running.value) return `Mengunduh · ${props.job.progress}%`
  return label[props.job.state]
})
</script>

<template>
  <li class="px-4 py-2" :class="job.state === 'done' ? 'opacity-60' : ''">
    <div class="flex items-center gap-3">
      <RouterLink :to="to" class="flex min-w-0 flex-1 items-center gap-3">
        <div class="w-10 shrink-0 overflow-hidden rounded bg-surface">
          <img
            v-if="src && !failed"
            :src="src"
            :alt="job.entry_title"
            loading="lazy"
            class="aspect-2/3 size-full object-cover"
          />
          <div v-else class="aspect-2/3" />
        </div>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ job.entry_title }}</p>
          <p class="truncate text-xs text-muted-foreground">{{ job.item_name }}</p>
          <p
            class="truncate text-xs"
            :class="failedJob ? 'text-destructive' : 'text-muted-foreground/70'"
          >
            {{ meta }}
          </p>
        </div>
      </RouterLink>

      <Button
        v-if="job.state === 'failed' || job.state === 'paused'"
        variant="ghost"
        size="icon-sm"
        aria-label="Coba lagi"
        @click="$emit('retry')"
      >
        <RotateCw class="size-4" />
      </Button>

      <!-- Satu tombol untuk "batalkan" dan "hapus": keduanya sama-sama berarti
           berkasnya dibuang, dan membedakannya cuma menambah tombol. -->
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="job.state === 'done' ? 'Hapus unduhan' : 'Batalkan'"
        @click="$emit('remove')"
      >
        <Trash2 class="size-4" />
      </Button>
    </div>

    <!-- Bilah cuma tampil selama pekerjaannya belum tuntas; baris yang sudah
         tersimpan tidak perlu garis penuh yang tidak berarti apa-apa lagi. -->
    <div v-if="job.state !== 'done'" class="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
      <div
        class="h-full rounded-full transition-[width] duration-300"
        :class="failedJob ? 'bg-destructive' : 'bg-primary'"
        :style="{ width: `${Math.max(job.progress, 2)}%` }"
      />
    </div>
  </li>
</template>
