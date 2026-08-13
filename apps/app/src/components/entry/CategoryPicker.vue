<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CategoryRow } from '@mirai/db'
import { Button } from '@/components/ui/button'

const { t } = useI18n()

const props = defineProps<{ all: CategoryRow[]; selected: CategoryRow[] }>()
const emit = defineEmits<{ save: [ids: string[]]; close: [] }>()

/**
 * Dialog kategori mengirim **keadaan akhir** yang diinginkan, bukan selisihnya —
 * itu sebabnya `setForEntry()` di repository menghapus lalu menulis ulang.
 */
const checked = ref<string[]>([])

watch(
  () => props.selected,
  (value) => {
    checked.value = value.map((category) => category.id)
  },
  { immediate: true },
)

function toggle(id: string): void {
  checked.value = checked.value.includes(id)
    ? checked.value.filter((item) => item !== id)
    : [...checked.value, id]
}
</script>

<template>
  <div class="rounded-md border border-border bg-surface/40 p-3">
    <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {{ t('entry.categories') }}
    </p>

    <p v-if="all.length === 0" class="text-sm text-muted-foreground">
      {{ t('entry.categoryPickerEmpty') }}
    </p>

    <ul v-else class="space-y-1">
      <li v-for="category in all" :key="category.id">
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            class="size-4 accent-primary"
            :checked="checked.includes(category.id)"
            @change="toggle(category.id)"
          />
          {{ category.name }}
        </label>
      </li>
    </ul>

    <div class="mt-3 flex justify-end gap-2">
      <Button variant="ghost" size="sm" @click="emit('close')">{{ t('common.close') }}</Button>
      <Button v-if="all.length > 0" size="sm" @click="emit('save', checked)">
        {{ t('common.save') }}
      </Button>
    </div>
  </div>
</template>
