<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppHeader from '@/components/layout/AppHeader.vue'
import { Card, CardContent } from '@/components/ui/card'

const { t } = useI18n()
const version = __APP_VERSION__
</script>

<template>
  <AppHeader :title="t('about.title')" />

  <div class="mx-auto max-w-2xl space-y-4 p-4">
    <Card>
      <CardContent class="space-y-2 p-4">
        <p class="text-lg font-semibold">Mirai</p>
        <p class="text-sm text-muted-foreground">{{ t('about.version', { version }) }}</p>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="space-y-3 p-4 text-sm text-muted-foreground">
        <p>{{ t('about.intro') }}</p>
        <p>{{ t('about.responsibility') }}</p>
      </CardContent>
    </Card>
  </div>
</template>
