<script setup lang="ts">
import { onMounted } from 'vue'
import { Download, Pause, Play, Trash2 } from '@lucide/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import DownloadRow from '@/components/downloads/DownloadRow.vue'
import { Button } from '@/components/ui/button'
import { useDownloadsStore } from '@/stores/downloads'

const store = useDownloadsStore()

// Antreannya sudah jalan sejak app dibuka; halaman ini cuma memastikan yang
// tampil bukan cerminan basi dari kunjungan sebelumnya.
onMounted(() => {
  void store.refresh()
})
</script>

<template>
  <AppHeader title="Unduhan">
    <template #tabs>
      <div v-if="store.jobs.length > 0" class="flex flex-wrap items-center gap-2 px-4 pb-3">
        <Button
          v-if="store.active.length > 0"
          variant="outline"
          size="sm"
          data-testid="downloads-toggle"
          @click="store.halted ? store.resume() : store.pause()"
        >
          <component :is="store.halted ? Play : Pause" class="size-4" />
          {{ store.halted ? 'Lanjutkan' : 'Jeda' }}
        </Button>

        <Button
          v-if="store.finished.length > 0"
          variant="ghost"
          size="sm"
          @click="store.clearFinished()"
        >
          <Trash2 class="size-4" />
          Bersihkan yang selesai
        </Button>

        <p class="text-xs text-muted-foreground">
          {{ store.working }} berjalan · {{ store.finished.length }} tersimpan
        </p>
      </div>
    </template>
  </AppHeader>

  <p v-if="store.error" class="mx-4 mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
    {{ store.error }}
  </p>

  <ul v-if="store.jobs.length > 0" class="divide-y divide-border pb-24 md:pb-8">
    <DownloadRow
      v-for="job in store.jobs"
      :key="job.id"
      :job="job"
      @retry="store.retryJob(job)"
      @remove="store.discard(job)"
    />
  </ul>

  <EmptyState
    v-else
    :icon="Download"
    title="Belum ada unduhan"
    description="Chapter yang kamu unduh bisa dibaca tanpa internet — tombol unduhnya ada di setiap baris chapter."
  />
</template>
