<script setup lang="ts">
import { computed } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { browserUserAgent, settings } from '@/services/settings.service'
import { transport } from '@/services/extensions.service'

const active = computed(() => settings.userAgent.trim() !== '')

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
        Tema, mode baca, kualitas video, dan penyimpanan masuk di fase berikutnya.
      </p>
    </section>
  </div>
</template>
