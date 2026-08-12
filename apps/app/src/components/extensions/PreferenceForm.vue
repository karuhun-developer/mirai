<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SourcePreference } from '@mirai/extension-api'
import type { PreferenceSnapshot } from '@mirai/extension-runtime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

/**
 * Merender `SourcePreference[]` yang dideklarasikan extension. Bentuknya
 * deklaratif justru supaya extension tidak pernah mengirim komponen — app yang
 * memutuskan tampilannya, dan kode asing tidak menyentuh DOM sama sekali.
 */

const props = defineProps<{
  schema: SourcePreference[]
  values: PreferenceSnapshot
  busy?: boolean
}>()

const emit = defineEmits<{ save: [PreferenceSnapshot]; cancel: [] }>()

const draft = ref<PreferenceSnapshot>({})

/** Nilai yang belum pernah diubah pengguna diisi default dari extension. */
function reset(): void {
  const next: PreferenceSnapshot = {}
  for (const preference of props.schema) {
    const stored = props.values[preference.key]
    next[preference.key] =
      stored ?? (preference.type === 'multiselect' ? [...preference.default] : preference.default)
  }
  draft.value = next
}

watch(() => [props.schema, props.values], reset, { immediate: true, deep: true })

function textValue(key: string): string {
  const value = draft.value[key]
  return typeof value === 'string' ? value : ''
}

function boolValue(key: string): boolean {
  return draft.value[key] === true
}

function listValue(key: string): string[] {
  const value = draft.value[key]
  return Array.isArray(value) ? value : []
}

function set(key: string, value: string | boolean | string[]): void {
  draft.value = { ...draft.value, [key]: value }
}

function toggleMulti(key: string, value: string, checked: boolean): void {
  const current = listValue(key)
  set(key, checked ? [...current, value] : current.filter((item) => item !== value))
}

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
</script>

<template>
  <form
    class="flex flex-col gap-4 border-t border-border px-3 py-4"
    @submit.prevent="emit('save', draft)"
  >
    <div v-for="preference in schema" :key="preference.key" class="flex flex-col gap-1.5">
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <label :for="`pref-${preference.key}`" class="block text-sm font-medium">
            {{ preference.title }}
          </label>
          <p v-if="preference.summary" class="mt-0.5 text-xs text-muted-foreground">
            {{ preference.summary }}
          </p>
        </div>

        <Switch
          v-if="preference.type === 'switch'"
          :id="`pref-${preference.key}`"
          :model-value="boolValue(preference.key)"
          class="mt-0.5"
          @update:model-value="set(preference.key, $event)"
        />
      </div>

      <Input
        v-if="preference.type === 'text'"
        :id="`pref-${preference.key}`"
        :model-value="textValue(preference.key)"
        :placeholder="preference.placeholder"
        @update:model-value="set(preference.key, $event)"
      />

      <select
        v-else-if="preference.type === 'list'"
        :id="`pref-${preference.key}`"
        :class="selectClass"
        :value="textValue(preference.key)"
        @change="set(preference.key, ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="(entry, index) in preference.entries"
          :key="entry"
          :value="preference.values[index]"
        >
          {{ entry }}
        </option>
      </select>

      <div v-else-if="preference.type === 'multiselect'" class="flex flex-wrap gap-x-4 gap-y-2">
        <label
          v-for="(entry, index) in preference.entries"
          :key="entry"
          class="flex items-center gap-2 text-sm"
        >
          <input
            type="checkbox"
            class="size-4 accent-primary"
            :checked="listValue(preference.key).includes(preference.values[index] ?? '')"
            @change="
              toggleMulti(
                preference.key,
                preference.values[index] ?? '',
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          {{ entry }}
        </label>
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" @click="emit('cancel')">Batal</Button>
      <Button type="submit" size="sm" :disabled="busy">Simpan</Button>
    </div>
  </form>
</template>
