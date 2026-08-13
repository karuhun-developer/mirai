<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ShieldAlert } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { openChallenge, type ChallengeInfo } from '@/services/challenge.service'

/**
 * Tampilan khusus untuk tantangan Cloudflare.
 *
 * Dipisah dari pesan error biasa karena tindakan yang diminta berbeda: bukan
 * "coba lagi", melainkan "selesaikan verifikasinya sendiri". Menyamakan
 * keduanya membuat pengguna menekan Muat Ulang berkali-kali untuk keadaan yang
 * tidak akan pernah berubah dengan sendirinya.
 */
const props = defineProps<{ challenge: ChallengeInfo; sourceName: string }>()

/**
 * `solved` tidak berarti "verifikasinya berhasil" — tidak ada yang bisa tahu
 * itu dari sini. Artinya "orangnya sudah kembali", dan satu-satunya cara
 * memastikan hasilnya memang mencoba lagi.
 */
const emit = defineEmits<{ solved: [] }>()

const { t } = useI18n()

async function open(): Promise<void> {
  await openChallenge(props.challenge.url)
  emit('solved')
}
</script>

<template>
  <div class="mx-4 mt-4 rounded-md border border-border bg-secondary/40 p-4">
    <div class="flex items-start gap-3">
      <ShieldAlert class="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div class="min-w-0 flex-1 space-y-2">
        <p class="text-sm font-medium">{{ t('cloudflare.title', { source: sourceName }) }}</p>

        <p class="text-sm text-muted-foreground">{{ t('cloudflare.body') }}</p>

        <p v-if="!challenge.canSolve" class="text-sm text-muted-foreground">
          <strong class="font-medium text-foreground">{{
            t('cloudflare.webWarningStrong')
          }}</strong>
          {{ t('cloudflare.webWarning') }}
        </p>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" :variant="challenge.canSolve ? 'default' : 'outline'" @click="open">
            {{ challenge.canSolve ? t('cloudflare.solve') : t('cloudflare.openSite') }}
          </Button>
          <Button as-child size="sm" variant="ghost">
            <RouterLink to="/settings">{{ t('cloudflare.changeUserAgent') }}</RouterLink>
          </Button>
        </div>

        <p class="text-xs text-muted-foreground">{{ t('cloudflare.stillBlocked') }}</p>
      </div>
    </div>
  </div>
</template>
