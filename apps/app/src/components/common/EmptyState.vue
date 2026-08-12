<script setup lang="ts">
import type { FunctionalComponent } from 'vue'
import type { LucideProps } from '@lucide/vue'

defineProps<{
  icon: FunctionalComponent<LucideProps>
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
    <div class="grid size-14 place-items-center rounded-full bg-secondary text-muted-foreground">
      <component :is="icon" class="size-7" />
    </div>
    <p class="text-base font-medium">{{ title }}</p>
    <p v-if="description" class="max-w-sm text-sm text-muted-foreground">{{ description }}</p>
    <div class="mt-1">
      <slot />
    </div>
  </div>
</template>
