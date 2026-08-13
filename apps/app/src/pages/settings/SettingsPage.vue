<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { LOCALES, setLocale, type LocaleCode } from '@/i18n'
import { browserUserAgent, settings } from '@/services/settings.service'
import { transport } from '@/services/extensions.service'
import { storageEstimate } from '@/services/storage.service'
import { humanBytes } from '@/services/storageQuota'
import { summarize } from '@/services/backupFormat'
import { useDownloadsStore } from '@/stores/downloads'
import { useBackupStore } from '@/stores/backup'

const { t, locale } = useI18n()

const active = computed(() => settings.userAgent.trim() !== '')

const downloads = useDownloadsStore()
const usage = ref<{ used: number; quota: number } | null>(null)

const CONCURRENCY = [1, 2, 3, 4]

const backup = useBackupStore()
const filePicker = ref<HTMLInputElement | null>(null)

const staged = computed(() => (backup.pending ? summarize(backup.pending) : null))

const stagedDate = computed(() =>
  backup.pending?.createdAt
    ? // Format tanggalnya mengikuti bahasa yang sedang dipakai, bukan bahasa
      // perangkat: dua-duanya tampil di layar yang sama.
      new Date(backup.pending.createdAt).toLocaleString(locale.value, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : t('settings.backup.stagedUnknownDate'),
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
  <AppHeader :title="t('settings.title')" />

  <div class="space-y-8 px-4 py-6 pb-24 md:pb-8">
    <section class="space-y-3">
      <div>
        <h2 class="text-base font-medium">{{ t('settings.appearance.heading') }}</h2>
        <p class="text-sm text-muted-foreground">{{ t('settings.appearance.description') }}</p>
      </div>

      <div class="space-y-2 rounded-md border border-border p-4">
        <p class="text-sm font-medium">{{ t('settings.appearance.language') }}</p>
        <div class="flex flex-wrap gap-2 pt-1">
          <!-- Pilihan "ikuti perangkat" tetap ada nilainya sendiri: menyamakannya
               dengan salah satu bahasa membuat pengguna yang berpindah perangkat
               terkunci di bahasa yang dulu kebetulan terpilih. -->
          <Button
            size="sm"
            :variant="settings.locale === '' ? 'default' : 'outline'"
            @click="settings.locale = ''"
          >
            {{ t('settings.appearance.systemLanguage') }}
          </Button>
          <Button
            v-for="option in LOCALES"
            :key="option.code"
            size="sm"
            :variant="settings.locale === option.code ? 'default' : 'outline'"
            @click="setLocale(option.code as LocaleCode)"
          >
            {{ option.label }}
          </Button>
        </div>
        <p class="pt-1 text-xs text-muted-foreground">
          {{ t('settings.appearance.languageHint') }}
        </p>
      </div>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-base font-medium">{{ t('settings.privacy.heading') }}</h2>
      </div>

      <div class="space-y-2 rounded-md border border-border p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-sm font-medium">{{ t('settings.privacy.incognito') }}</p>
            <p class="text-sm text-muted-foreground">{{ t('settings.privacy.incognitoHint') }}</p>
          </div>
          <Switch v-model="settings.incognito" :aria-label="t('settings.privacy.incognito')" />
        </div>
        <p class="pt-1 text-xs text-muted-foreground">{{ t('settings.privacy.incognitoOff') }}</p>
      </div>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-base font-medium">{{ t('settings.downloads.heading') }}</h2>
        <p class="text-sm text-muted-foreground">{{ t('settings.downloads.description') }}</p>
      </div>

      <div class="space-y-4 rounded-md border border-border p-4">
        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t('settings.downloads.concurrency') }}</p>
          <p class="text-sm text-muted-foreground">
            {{ t('settings.downloads.concurrencyHint') }}
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
            <p class="text-sm font-medium">{{ t('settings.downloads.deleteAfterRead') }}</p>
            <p class="text-sm text-muted-foreground">
              {{ t('settings.downloads.deleteAfterReadHint') }}
            </p>
          </div>
          <Switch
            :model-value="downloads.prefs.deleteAfterRead"
            :aria-label="t('settings.downloads.deleteAfterRead')"
            @update:model-value="downloads.setPrefs({ deleteAfterRead: $event })"
          />
        </div>

        <div v-if="usage" class="space-y-2 border-t border-border pt-4">
          <p class="text-xs text-muted-foreground">
            {{
              t('settings.downloads.usage', {
                used: humanBytes(usage.used),
                quota: humanBytes(usage.quota),
              })
            }}
          </p>
          <!-- Satu episode anime bisa ratusan megabita; peringatannya diulang di sini
               karena inilah halaman tempat orang mencari "kenapa penuh". -->
          <p
            v-if="downloads.storage.messageKey"
            class="text-xs"
            :class="downloads.storage.level === 'full' ? 'text-destructive' : 'text-foreground'"
          >
            {{ t(downloads.storage.messageKey!, { free: humanBytes(downloads.storage.free) }) }}
          </p>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-base font-medium">{{ t('settings.backup.heading') }}</h2>
        <p class="text-sm text-muted-foreground">{{ t('settings.backup.description') }}</p>
      </div>

      <div class="space-y-4 rounded-md border border-border p-4">
        <div class="flex flex-wrap gap-2">
          <Button size="sm" :disabled="backup.busy" @click="backup.exportNow()">
            {{ t('settings.backup.export') }}
          </Button>
          <Button size="sm" variant="outline" :disabled="backup.busy" @click="pickFile">
            {{ t('settings.backup.import') }}
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
            <p class="text-sm font-medium">
              {{ t('settings.backup.stagedTitle', { date: stagedDate }) }}
            </p>
            <p class="text-sm text-muted-foreground">
              {{ t('settings.backup.stagedCounts', { ...staged }) }}
            </p>
            <p class="pt-1 text-xs text-muted-foreground">
              {{ t('settings.backup.mergeNotice') }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" :disabled="backup.busy" @click="backup.confirm()">
              {{ t('settings.backup.confirm') }}
            </Button>
            <Button size="sm" variant="ghost" :disabled="backup.busy" @click="backup.discard()">
              {{ t('common.cancel') }}
            </Button>
          </div>
        </div>

        <p v-if="backup.report" class="border-t border-border pt-4 text-sm text-foreground">
          {{ backup.report }}
        </p>
        <p
          v-if="backup.error"
          role="alert"
          class="border-t border-border pt-4 text-sm text-destructive"
        >
          {{ backup.error }}
        </p>
      </div>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-base font-medium">{{ t('settings.advanced.heading') }}</h2>
        <p class="text-sm text-muted-foreground">{{ t('settings.advanced.description') }}</p>
      </div>

      <div class="space-y-2 rounded-md border border-border p-4">
        <label for="user-agent" class="text-sm font-medium">
          {{ t('settings.advanced.userAgent') }}
        </label>
        <p class="text-sm text-muted-foreground">{{ t('settings.advanced.userAgentHint') }}</p>

        <Input
          id="user-agent"
          v-model="settings.userAgent"
          :placeholder="t('settings.advanced.userAgentPlaceholder')"
          :aria-label="t('settings.advanced.userAgent')"
        />

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="outline" @click="useBrowserAgent">
            {{ t('settings.advanced.useBrowserAgent') }}
          </Button>
          <Button size="sm" variant="ghost" :disabled="!active" @click="reset">
            {{ t('settings.advanced.resetUserAgent') }}
          </Button>
        </div>

        <p class="pt-1 text-xs text-muted-foreground">
          {{
            active
              ? t('settings.advanced.userAgentActive')
              : t('settings.advanced.userAgentInactive')
          }}
          <template v-if="!transport.isNative">
            {{ t('settings.advanced.userAgentWebNote') }}
          </template>
        </p>
      </div>
    </section>
  </div>
</template>
