<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { browserUserAgent, settings } from '@/services/settings.service'
import { transport } from '@/services/extensions.service'
import { storageEstimate } from '@/services/storage.service'
import { useDownloadsStore } from '@/stores/downloads'

const active = computed(() => settings.userAgent.trim() !== '')

const downloads = useDownloadsStore()
const usage = ref<{ used: number; quota: number } | null>(null)

const CONCURRENCY = [1, 2, 3, 4]

onMounted(async () => {
  await downloads.loadPrefs()
  usage.value = await storageEstimate()
})

/** Ukuran dalam satuan yang dibaca manusia; angka byte mentah tidak berarti apa-apa. */
function human(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`
}

function useBrowserAgent(): void {
  settings.userAgent = browserUserAgent()
}

function reset(): void {
  settings.userAgent = ''
}
</script>

<template>
  <AppHeader title="Pengaturan" />

  <div class="space-y-8 px-4 py-6 pb-24 md:pb-8">
    <section class="space-y-3">
      <div>
        <h2 class="text-base font-medium">Unduhan</h2>
        <p class="text-sm text-muted-foreground">
          Chapter yang diunduh tersimpan di perangkat dan tetap terbaca tanpa internet.
        </p>
      </div>

      <div class="space-y-4 rounded-md border border-border p-4">
        <div class="space-y-2">
          <p class="text-sm font-medium">Unduhan berbarengan</p>
          <p class="text-sm text-muted-foreground">
            Berapa chapter dikerjakan sekaligus. Halaman di dalam satu chapter selalu berurutan —
            menembakkan puluhan permintaan sekaligus adalah cara tercepat diblokir situs sumbernya.
          </p>
          <div class="flex gap-2 pt-1">
            <Button
              v-for="value in CONCURRENCY"
              :key="value"
              size="sm"
              :variant="downloads.prefs.concurrency === value ? 'default' : 'outline'"
              @click="downloads.setPrefs({ concurrency: value })"
            >
              {{ value }}
            </Button>
          </div>
        </div>

        <div class="flex items-start justify-between gap-4 border-t border-border pt-4">
          <div class="min-w-0">
            <p class="text-sm font-medium">Hapus setelah dibaca</p>
            <p class="text-sm text-muted-foreground">
              Berkas chapter dibuang begitu reader ditutup dan chapternya sudah tamat. Menghemat
              ruang kalau kebiasaannya mengunduh untuk sekali baca.
            </p>
          </div>
          <Switch
            :model-value="downloads.prefs.deleteAfterRead"
            aria-label="Hapus setelah dibaca"
            @update:model-value="downloads.setPrefs({ deleteAfterRead: $event })"
          />
        </div>

        <p v-if="usage" class="border-t border-border pt-4 text-xs text-muted-foreground">
          Terpakai {{ human(usage.used) }} dari kuota {{ human(usage.quota) }} yang diberikan
          browser. Angkanya mencakup seluruh data Mirai di peramban ini, bukan cuma unduhan.
        </p>
      </div>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-base font-medium">Lanjutan</h2>
        <p class="text-sm text-muted-foreground">
          Setelan jaringan. Tidak perlu disentuh selama sumbernya jalan.
        </p>
      </div>

      <div class="space-y-2 rounded-md border border-border p-4">
        <label for="user-agent" class="text-sm font-medium">User-Agent</label>
        <p class="text-sm text-muted-foreground">
          Menimpa identitas browser yang dikirim semua extension. Kosongkan untuk membiarkan tiap
          extension memilih sendiri — itu bawaannya, dan biasanya yang paling benar. Gunanya kalau
          sebuah situs menahan Mirai dengan verifikasi Cloudflare: izin hasil verifikasi hanya
          berlaku untuk User-Agent yang menyelesaikannya, jadi keduanya harus sama persis.
        </p>

        <Input
          id="user-agent"
          v-model="settings.userAgent"
          placeholder="Kosong — pakai bawaan extension"
          aria-label="User-Agent"
        />

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="outline" @click="useBrowserAgent">
            Pakai UA browser ini
          </Button>
          <Button size="sm" variant="ghost" :disabled="!active" @click="reset">
            Kembalikan ke bawaan
          </Button>
        </div>

        <p class="pt-1 text-xs text-muted-foreground">
          {{
            active
              ? 'Aktif. Berlaku untuk request berikutnya, tanpa perlu memuat ulang.'
              : 'Nonaktif — extension memakai User-Agent-nya sendiri.'
          }}
          <template v-if="!transport.isNative">
            Di versi web, request tetap dikirim proxy dari mesin lain, jadi mengganti User-Agent
            saja tidak cukup untuk melewati verifikasi Cloudflare.
          </template>
        </p>
      </div>
    </section>

    <section class="space-y-1">
      <h2 class="text-base font-medium">Menyusul</h2>
      <p class="text-sm text-muted-foreground">
        Tema, backup, dan tracker masuk di fase berikutnya. Mode baca dan kualitas video sudah ada
        di dalam reader dan pemutarnya masing-masing.
      </p>
    </section>
  </div>
</template>
