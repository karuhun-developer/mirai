<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SEntry } from '@mirai/extension-api'
import type { RemoteSource } from '@mirai/extension-runtime'
import type { EntryRow } from '@mirai/db'
import type { MigrationResult } from '@/services/migrate.service'
import ChallengeNotice from '@/components/common/ChallengeNotice.vue'
import MigrateCandidate from '@/components/entry/MigrateCandidate.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useExtensionsStore } from '@/stores/extensions'
import { useMigrateStore } from '@/stores/migrate'

/**
 * Dialog migrasi: pilih source tujuan → cari judulnya di sana → pilih yang
 * benar → pindahkan.
 *
 * Tiga langkah, bukan satu tombol "pindahkan otomatis": mencocokkan judul lintas
 * situs selalu meleset di sekuel dan judul alternatif, dan yang dipertaruhkan
 * adalah progres baca berbulan-bulan.
 */
const { t } = useI18n()
const extensions = useExtensionsStore()
const migrate = useMigrateStore()

const props = defineProps<{ entry: EntryRow }>()
const emit = defineEmits<{ done: [result: MigrationResult]; close: [] }>()

/** Source lain yang sejenis; source asal sendiri jelas bukan tujuan migrasi. */
const targets = computed<RemoteSource[]>(() =>
  extensions.sources.filter(
    (source) => source.kind === props.entry.kind && source.id !== props.entry.source_id,
  ),
)

/** Objeknya dirakit ulang dari id yang disimpan store; lihat `stores/migrate.ts`. */
const target = computed<RemoteSource | undefined>(() =>
  targets.value.find((source) => source.id === migrate.targetId),
)

const query = ref(props.entry.title)
const selected = ref<SEntry | null>(null)
/**
 * Bawaannya menghapus yang lama. Membiarkan keduanya di library adalah cara
 * mendapat dua baris judul yang sama dengan progres yang mulai berbeda —
 * pengguna yang memang ingin membandingkan bisa mematikannya di sini.
 */
const removeOld = ref(true)

async function search(source: RemoteSource): Promise<void> {
  selected.value = null
  await migrate.search(source, query.value.trim())
}

async function run(): Promise<void> {
  const source = target.value
  if (!source || !selected.value) return
  const result = await migrate.run(props.entry, source, selected.value, removeOld.value)
  if (result) emit('done', result)
}
</script>

<template>
  <div class="rounded-md border border-border bg-surface/40 p-3">
    <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {{ t('migrate.title') }}
    </p>

    <p v-if="targets.length === 0" class="text-sm text-muted-foreground">
      {{ t('migrate.noTargets') }}
    </p>

    <template v-else>
      <p class="mb-2 text-sm text-muted-foreground">{{ t('migrate.description') }}</p>

      <Input v-model="query" :aria-label="t('migrate.query')" :placeholder="t('migrate.query')" />

      <div class="mt-2 flex flex-wrap gap-2">
        <Button
          v-for="source in targets"
          :key="source.id"
          size="sm"
          :variant="migrate.targetId === source.id ? 'default' : 'outline'"
          :disabled="migrate.searching || migrate.running"
          @click="search(source)"
        >
          {{ source.name }}
        </Button>
      </div>

      <ChallengeNotice
        v-if="migrate.challenge"
        class="mt-2"
        :challenge="migrate.challenge"
        :source-name="target?.name ?? t('browse.thisSource')"
        @solved="target && search(target)"
      />

      <p v-else-if="migrate.error" class="mt-2 text-sm text-destructive">{{ migrate.error }}</p>

      <p v-if="migrate.searching" class="mt-3 text-sm text-muted-foreground">
        {{ t('common.loading') }}
      </p>

      <p
        v-else-if="migrate.targetId && migrate.candidates.length === 0"
        class="mt-3 text-sm text-muted-foreground"
      >
        {{ t('migrate.noResults') }}
      </p>

      <ul v-else class="mt-2 max-h-72 space-y-1 overflow-y-auto">
        <li v-for="candidate in migrate.candidates" :key="candidate.url">
          <MigrateCandidate
            :entry="candidate"
            :selected="selected?.url === candidate.url"
            @select="selected = candidate"
          />
        </li>
      </ul>

      <label v-if="selected" class="mt-3 flex items-center justify-between gap-4">
        <span class="min-w-0">
          <span class="block text-sm font-medium">{{ t('migrate.removeOld') }}</span>
          <span class="block text-xs text-muted-foreground">{{ t('migrate.removeOldHint') }}</span>
        </span>
        <Switch v-model="removeOld" />
      </label>

      <!-- Peringatan unduhan tidak disembunyikan di balik tautan bantuan: chapter
           yang sudah diunduh adalah alasan paling sering orang menunda migrasi. -->
      <p v-if="selected" class="mt-2 text-xs text-muted-foreground">
        {{ t('migrate.downloadsNotice') }}
      </p>

      <div class="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" :disabled="migrate.running" @click="emit('close')">
          {{ t('common.cancel') }}
        </Button>
        <Button size="sm" :disabled="!selected || migrate.running" @click="run()">
          {{ migrate.running ? t('migrate.running') : t('migrate.confirm') }}
        </Button>
      </div>
    </template>

    <div v-if="targets.length === 0" class="mt-3 flex justify-end">
      <Button variant="ghost" size="sm" @click="emit('close')">{{ t('common.close') }}</Button>
    </div>
  </div>
</template>
