<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { browserUserAgent, settings } from '@/services/settings.service'
import { transport } from '@/services/extensions.service'
import { storageEstimate } from '@/services/storage.service'
import { humanBytes } from '@/services/storageQuota'
import { summarize } from '@/services/backupFormat'
import { useDownloadsStore } from '@/stores/downloads'
import { useBackupStore } from '@/stores/backup'

const active = computed(() => settings.userAgent.trim() !== '')

const downloads = useDownloadsStore()
const usage = ref<{ used: number; quota: number } | null>(null)

const CONCURRENCY = [1, 2, 3, 4]

const backup = useBackupStore()
const filePicker = ref<HTMLInputElement | null>(null)

const staged = computed(() => (backup.pending ? summarize(backup.pending) : null))

const stagedDate = computed(() =>
  backup.pending?.createdAt
    ? new Date(backup.pending.createdAt).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'tanggal tidak diketahui',
)

/**
 * `<input type="file">` disembunyikan dan dipicu tombol: kontrol bawaannya
 * membawa gaya sistem yang tidak bisa diseragamkan dengan tombol lain, dan di
 * WebView Android tampilannya berbeda lagi.
 */
function pickFile(): void {
  filePicker.value?.click()
}

async function onFilePicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Nilainya dikosongkan supaya memilih berkas yang sama dua kali tetap memicu
  // `change` — jalur yang dipakai orang setelah percobaan pertama gagal.
  input.value = ''
  if (file) await backup.stage(file)
}

onMounted(async () => {
  await downloads.loadPrefs()
  await downloads.refreshStorage()
  usage.value = await storageEstimate()
})

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

        <div v-if="usage" class="space-y-2 border-t border-border pt-4">
          <p class="text-xs text-muted-foreground">
            Terpakai {{ humanBytes(usage.used) }} dari kuota {{ humanBytes(usage.quota) }} yang
            diberikan browser. Angkanya mencakup seluruh data Mirai di peramban ini, bukan cuma
            unduhan.
          </p>
          <!-- Satu episode anime bisa ratusan megabita; peringatannya diulang di sini
               karena inilah halaman tempat orang mencari "kenapa penuh". -->
          <p
            v-if="downloads.storage.message"
            class="text-xs"
            :class="downloads.storage.level === 'full' ? 'text-destructive' : 'text-foreground'"
          >
            {{ downloads.storage.message }}
          </p>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-base font-medium">Backup</h2>
        <p class="text-sm text-muted-foreground">
          Menyalin library, kategori, progres baca, riwayat, dan daftar extension ke satu berkas
          JSON. Berkas unduhan tidak ikut — ukurannya bisa gigabita, dan chapternya bisa diunduh
          ulang.
        </p>
      </div>

      <div class="space-y-4 rounded-md border border-border p-4">
        <div class="flex flex-wrap gap-2">
          <Button size="sm" :disabled="backup.busy" @click="backup.exportNow()">
            Buat backup
          </Button>
          <Button size="sm" variant="outline" :disabled="backup.busy" @click="pickFile">
            Pulihkan dari berkas
          </Button>
          <input
            ref="filePicker"
            type="file"
            accept="application/json,.json"
            class="hidden"
            @change="onFilePicked"
          />
        </div>

        <!-- Isi berkas ditunjukkan sebelum ditulis: restore menggabungkan data ke
             library yang sedang dipakai dan tidak punya tombol batal. -->
        <div v-if="staged" class="space-y-3 border-t border-border pt-4">
          <div>
            <p class="text-sm font-medium">Backup dari {{ stagedDate }}</p>
            <p class="text-sm text-muted-foreground">
              {{ staged.entries }} judul · {{ staged.categories }} kategori ·
              {{ staged.items }} chapter/episode · {{ staged.history }} riwayat ·
              {{ staged.extensions }} extension
            </p>
            <p class="pt-1 text-xs text-muted-foreground">
              Isinya digabung dengan yang sudah ada di perangkat ini. Tidak ada yang dihapus; judul
              yang sama dimenangkan berkas backup.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" :disabled="backup.busy" @click="backup.confirm()">
              Pulihkan sekarang
            </Button>
            <Button size="sm" variant="ghost" :disabled="backup.busy" @click="backup.discard()">
              Batal
            </Button>
          </div>
        </div>

        <p v-if="backup.report" class="border-t border-border pt-4 text-sm text-foreground">
          {{ backup.report.message }}
        </p>
        <p v-if="backup.error" class="border-t border-border pt-4 text-sm text-destructive">
          {{ backup.error }}
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
  </div>
</template>
