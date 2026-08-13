<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Plus, Trash2 } from '@lucide/vue'
import type { CategoryRow, LibrarySort } from '@mirai/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { LibraryPrefs } from '@/services/library.service'

const { t } = useI18n()

const props = defineProps<{ prefs: LibraryPrefs; categories: CategoryRow[] }>()

const emit = defineEmits<{
  update: [patch: Partial<LibraryPrefs>]
  addCategory: [name: string]
  dropCategory: [id: string]
}>()

const newCategory = ref('')

const sorts: { key: LibrarySort; labelKey: string }[] = [
  { key: 'title', labelKey: 'library.filters.sortTitle' },
  { key: 'added', labelKey: 'library.filters.sortAdded' },
  { key: 'last_read', labelKey: 'library.filters.sortLastRead' },
  { key: 'unread', labelKey: 'library.filters.sortUnread' },
]

/**
 * Menekan pengurutan yang sedang aktif membalik arahnya — kebiasaan yang sama
 * dengan header tabel di mana-mana, dan menghemat satu tombol arah tersendiri.
 */
function pickSort(key: LibrarySort): void {
  if (props.prefs.sort === key) emit('update', { descending: !props.prefs.descending })
  else emit('update', { sort: key, descending: key !== 'title' })
}

function submitCategory(): void {
  const name = newCategory.value.trim()
  if (!name) return
  emit('addCategory', name)
  newCategory.value = ''
}
</script>

<template>
  <div class="border-b border-border bg-surface/40 px-4 py-3 text-sm">
    <div class="mx-auto max-w-3xl space-y-4">
      <section>
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ t('library.filters.sort') }}
        </p>
        <div class="flex flex-wrap gap-1">
          <Button
            v-for="sort in sorts"
            :key="sort.key"
            size="sm"
            :variant="prefs.sort === sort.key ? 'secondary' : 'ghost'"
            @click="pickSort(sort.key)"
          >
            {{ t(sort.labelKey) }}
            <span v-if="prefs.sort === sort.key" class="ml-1 text-xs">
              {{ prefs.descending ? '↓' : '↑' }}
            </span>
          </Button>
        </div>
      </section>

      <section class="space-y-2">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ t('library.filters.filter') }}
        </p>
        <label class="flex items-center justify-between gap-4">
          <span>{{ t('library.filters.unreadOnly') }}</span>
          <Switch
            :model-value="prefs.unreadOnly"
            @update:model-value="emit('update', { unreadOnly: $event })"
          />
        </label>
        <label class="flex items-center justify-between gap-4">
          <span>{{ t('library.filters.downloadedOnly') }}</span>
          <Switch
            :model-value="prefs.downloadedOnly"
            @update:model-value="emit('update', { downloadedOnly: $event })"
          />
        </label>
      </section>

      <section class="space-y-2">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ t('library.filters.categories') }}
        </p>

        <ul
          v-if="categories.length > 0"
          class="divide-y divide-border rounded-md border border-border"
        >
          <li
            v-for="category in categories"
            :key="category.id"
            class="flex items-center gap-2 px-3 py-2"
          >
            <span class="flex-1 truncate">{{ category.name }}</span>
            <Button
              variant="ghost"
              size="icon"
              :aria-label="t('library.filters.dropCategory', { name: category.name })"
              @click="emit('dropCategory', category.id)"
            >
              <Trash2 class="size-4" />
            </Button>
          </li>
        </ul>

        <form class="flex gap-2" @submit.prevent="submitCategory">
          <Input
            v-model="newCategory"
            :placeholder="t('library.filters.newCategory')"
            :aria-label="t('library.filters.newCategoryLabel')"
          />
          <Button
            type="submit"
            variant="outline"
            size="icon"
            :aria-label="t('library.filters.addCategory')"
          >
            <Plus class="size-4" />
          </Button>
        </form>

        <p class="text-xs text-muted-foreground">
          <Check class="mr-1 inline size-3" />
          {{ t('library.filters.dropHint') }}
        </p>
      </section>
    </div>
  </div>
</template>
