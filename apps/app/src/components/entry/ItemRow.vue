<script setup lang="ts">
import { computed } from 'vue'
import { Bookmark, Check, ChevronsDown } from '@lucide/vue'
import type { ItemRow } from '@mirai/db'
import { Button } from '@/components/ui/button'

const props = defineProps<{ item: ItemRow }>()

const emit = defineEmits<{
  toggleSeen: []
  toggleBookmark: []
  markUpTo: []
}>()

const seen = computed(() => props.item.seen === 1)

const subtitle = computed(() => {
  const parts: string[] = []
  if (props.item.date_upload !== null) {
    parts.push(new Date(props.item.date_upload).toLocaleDateString('id-ID'))
  }
  if (props.item.scanlator) parts.push(props.item.scanlator)
  // Progres cuma disebut kalau ada dan belum selesai — "halaman 0" bukan kabar.
  if (!seen.value && props.item.last_position > 0) {
    parts.push(`lanjut di ${props.item.last_position}`)
  }
  return parts.join(' · ')
})
</script>

<template>
  <li class="flex items-center gap-2 px-4 py-2.5" :class="seen ? 'opacity-50' : ''">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm" :class="seen ? 'font-normal' : 'font-medium'">
        {{ item.name }}
      </p>
      <p v-if="subtitle" class="truncate text-xs text-muted-foreground">{{ subtitle }}</p>
    </div>

    <Button
      variant="ghost"
      size="icon-sm"
      :aria-label="item.bookmark === 1 ? 'Hapus penanda' : 'Tandai'"
      @click="emit('toggleBookmark')"
    >
      <Bookmark class="size-4" :class="item.bookmark === 1 ? 'fill-primary text-primary' : ''" />
    </Button>

    <!--
      Menandai satu chapter biasanya berarti yang sebelumnya juga sudah dibaca —
      tombol terpisah ini menghemat puluhan ketukan pada judul panjang.
    -->
    <Button
      v-if="!seen"
      variant="ghost"
      size="icon-sm"
      aria-label="Tandai sampai sini sudah dibaca"
      @click="emit('markUpTo')"
    >
      <ChevronsDown class="size-4" />
    </Button>

    <Button
      variant="ghost"
      size="icon-sm"
      :aria-label="seen ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'"
      @click="emit('toggleSeen')"
    >
      <Check class="size-4" :class="seen ? 'text-primary' : ''" />
    </Button>
  </li>
</template>
