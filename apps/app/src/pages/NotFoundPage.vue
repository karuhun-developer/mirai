<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { CircleAlert } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'

const { t } = useI18n()
</script>

<template>
  <EmptyState
    :icon="CircleAlert"
    :title="t('notFound.title')"
    :description="t('notFound.description')"
  >
    <Button as-child variant="outline">
      <RouterLink to="/library/anime">{{ t('notFound.back') }}</RouterLink>
    </Button>
  </EmptyState>
</template>
