<script setup lang="ts">
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
        <p class="text-sm font-medium">{{ sourceName }} meminta verifikasi Cloudflare</p>

        <p class="text-sm text-muted-foreground">
          Situsnya hidup, tapi menahan Mirai dengan pemeriksaan "verify you are human". Mirai tidak
          memutari pemeriksaan itu — kamu yang menyelesaikannya sendiri, lalu kembali ke sini dan
          muat ulang.
        </p>

        <p v-if="!challenge.canSolve" class="text-sm text-muted-foreground">
          <strong class="font-medium text-foreground">Di versi web ini tidak akan berhasil.</strong>
          Permintaan dikirim lewat proxy dari mesin lain, sedangkan izin hasil verifikasi menempel
          pada browser dan alamat IP yang menyelesaikannya. Pakai APK-nya, atau pilih sumber lain.
        </p>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" :variant="challenge.canSolve ? 'default' : 'outline'" @click="open">
            {{ challenge.canSolve ? 'Selesaikan verifikasi' : 'Buka situsnya' }}
          </Button>
          <Button as-child size="sm" variant="ghost">
            <RouterLink to="/settings">Ubah User-Agent</RouterLink>
          </Button>
        </div>

        <p class="text-xs text-muted-foreground">
          Kalau setelah diselesaikan pun masih tertahan, sumber itu memang sedang tidak bisa
          dipakai.
        </p>
      </div>
    </div>
  </div>
</template>
