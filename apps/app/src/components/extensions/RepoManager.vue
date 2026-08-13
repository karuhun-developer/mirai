<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, TriangleAlert, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useExtensionsStore } from '@/stores/extensions'

const { t } = useI18n()
const store = useExtensionsStore()

const url = ref('')
const adding = ref(false)
const error = ref<string | null>(null)

async function submit(): Promise<void> {
  if (adding.value) return
  adding.value = true
  error.value = null

  try {
    await store.addRepo(url.value)
    url.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    adding.value = false
  }
}

/** Jumlah paket yang datang dari satu repo; jadi umpan balik bahwa repo terbaca. */
function packageCount(repoUrl: string): number {
  return store.catalog[repoUrl]?.length ?? 0
}
</script>

<template>
  <section class="flex flex-col gap-3 px-4 py-4">
    <h2 class="text-sm font-semibold">{{ t('extensions.repos.heading') }}</h2>

    <form class="flex gap-2" @submit.prevent="submit">
      <Input
        v-model="url"
        placeholder="https://contoh.github.io/extensions"
        :aria-label="t('extensions.repos.urlLabel')"
        inputmode="url"
      />
      <Button
        type="submit"
        size="icon"
        :disabled="adding || !url.trim()"
        :aria-label="t('extensions.repos.add')"
      >
        <Plus />
      </Button>
    </form>

    <p v-if="error" role="alert" class="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
      {{ error }}
    </p>

    <p v-if="store.repos.length === 0" class="text-xs text-muted-foreground">
      {{ t('extensions.repos.empty') }}
    </p>

    <ul v-else class="flex flex-col gap-1">
      <li
        v-for="repo in store.repos"
        :key="repo.url"
        class="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2"
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm">{{ repo.name }}</span>
          <span
            v-if="store.repoError[repo.url]"
            class="flex items-center gap-1 text-xs text-destructive"
          >
            <TriangleAlert class="size-3.5 shrink-0" />
            {{ store.repoError[repo.url] }}
          </span>
          <span v-else class="block truncate text-xs text-muted-foreground">
            {{ t('extensions.repos.packageCount', { count: packageCount(repo.url) }) }}
          </span>
        </span>

        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="t('extensions.repos.remove', { name: repo.name })"
          @click="store.removeRepo(repo.url)"
        >
          <Trash2 />
        </Button>
      </li>
    </ul>

    <p v-if="store.repos.length > 0" class="text-xs text-muted-foreground">
      {{ t('extensions.repos.hint') }}
    </p>
  </section>
</template>
