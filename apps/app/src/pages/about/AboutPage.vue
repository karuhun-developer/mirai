<script setup lang="ts">
import AppHeader from '@/components/layout/AppHeader.vue'
import { Card, CardContent } from '@/components/ui/card'

const version = __APP_VERSION__
</script>

<template>
  <AppHeader title="Tentang" />

  <div class="mx-auto max-w-2xl space-y-4 p-4">
    <Card>
      <CardContent class="space-y-2 p-4">
        <p class="text-lg font-semibold">Mirai</p>
        <p class="text-sm text-muted-foreground">Versi {{ version }}</p>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="space-y-3 p-4 text-sm text-muted-foreground">
        <p>
          Mirai adalah pembaca manga dan pemutar anime yang tidak membawa sumber konten apa pun.
          Seluruh katalog berasal dari extension yang kamu pasang sendiri.
        </p>
        <p>
          Kamu bertanggung jawab atas repo extension yang kamu tambahkan dan atas kepatuhan pada
          ketentuan layanan situs sumbernya.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
