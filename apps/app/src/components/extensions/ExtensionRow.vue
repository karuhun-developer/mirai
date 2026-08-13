<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, Clapperboard, Settings2, Trash2, TriangleAlert } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import PreferenceForm from '@/components/extensions/PreferenceForm.vue'
import { repoAssetUrl } from '@/services/extensionRepo.service'
import { useExtensionsStore, type ExtensionView } from '@/stores/extensions'

const { t } = useI18n()

const props = defineProps<{ row: ExtensionView }>()

const store = useExtensionsStore()
const showPrefs = ref(false)

const pkg = computed(() => props.row.entry.pkg)
const busy = computed(() => store.busy[pkg.value] === true)
const schema = computed(() => store.preferenceSchema(pkg.value))
const values = computed(() => store.preferenceValues(pkg.value))

const iconUrl = computed(() => {
  const icon = props.row.entry.icon
  return icon ? repoAssetUrl(props.row.repoUrl, icon) : undefined
})

/** Satu paket boleh berisi manga dan anime sekaligus; ikonnya mengikuti isinya. */
const kinds = computed(() => [...new Set(props.row.entry.sources.map((source) => source.kind))])

const subtitle = computed(() => {
  const languages = [...new Set(props.row.entry.sources.map((source) => source.lang))]
  return t('extensions.subtitle', {
    langs: languages.join(', ').toUpperCase(),
    version: props.row.entry.version,
    count: props.row.entry.sources.length,
  })
})

async function save(prefs: Parameters<typeof store.savePreferences>[1]): Promise<void> {
  await store.savePreferences(pkg.value, prefs)
  showPrefs.value = false
}
</script>

<template>
  <li class="rounded-lg border border-border">
    <div class="flex items-center gap-3 p-3">
      <span
        class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary"
      >
        <img v-if="iconUrl" :src="iconUrl" alt="" class="size-full object-cover" />
        <component :is="kinds[0] === 'anime' ? Clapperboard : BookOpen" v-else class="size-5" />
      </span>

      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-2 truncate text-sm font-medium">
          {{ row.entry.name }}
          <Badge v-if="row.entry.nsfw" variant="destructive">18+</Badge>
          <Badge v-if="row.updatable" variant="secondary">{{ t('extensions.update') }}</Badge>
        </p>
        <p class="truncate text-xs text-muted-foreground">{{ subtitle }}</p>
        <p
          v-if="row.incompatible"
          role="alert"
          class="mt-1 flex items-center gap-1 text-xs text-destructive"
        >
          <TriangleAlert class="size-3.5 shrink-0" />
          {{ row.incompatible }}
        </p>
      </div>

      <!--
        Semua aksi satu paket duduk di baris yang sama dengan namanya. Barisnya
        jadi padat, tapi daftar dengan puluhan paket lebih mudah dipindai kalau
        tiap paket setinggi satu baris — bukan dua.
      -->
      <div class="flex shrink-0 items-center gap-1">
        <template v-if="row.installed">
          <Switch
            :model-value="row.installed.enabled"
            :disabled="busy || row.incompatible !== undefined"
            :aria-label="t('extensions.enable', { name: row.entry.name })"
            @update:model-value="store.setEnabled(pkg, $event)"
          />
          <Button
            v-if="schema.length > 0"
            variant="ghost"
            size="icon-sm"
            :aria-label="t('extensions.preferences', { name: row.entry.name })"
            @click="showPrefs = !showPrefs"
          >
            <Settings2 />
          </Button>
        </template>

        <Button v-if="row.updatable" size="sm" :disabled="busy" @click="store.update(pkg)">
          {{ busy ? t('extensions.updating') : t('extensions.update') }}
        </Button>
        <Button
          v-else-if="!row.installed"
          size="sm"
          :disabled="busy || row.incompatible !== undefined"
          @click="store.install(row.entry, row.repoUrl)"
        >
          {{ busy ? t('extensions.installing') : t('extensions.install') }}
        </Button>
        <Button
          v-else
          variant="ghost"
          size="icon-sm"
          :disabled="busy"
          :aria-label="t('extensions.uninstall', { name: row.entry.name })"
          @click="store.uninstall(pkg)"
        >
          <Trash2 />
        </Button>
      </div>
    </div>

    <PreferenceForm
      v-if="showPrefs && schema.length > 0"
      :schema="schema"
      :values="values"
      :busy="busy"
      @save="save"
      @cancel="showPrefs = false"
    />
  </li>
</template>
