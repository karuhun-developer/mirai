import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { coverUrl, releaseCover } from '@/services/cover.service'

export interface CoverState {
  /** URL siap pakai untuk `<img>`; kosong selama belum ada hasil. */
  src: Ref<string>
  /** Cover tidak bisa ditampilkan — kartu jatuh ke tampilan berisi judul. */
  failed: Ref<boolean>
}

/**
 * Menyiapkan satu cover dan membereskannya sendiri.
 *
 * `coverUrl()` mengembalikan `blob:` URL yang menahan gambarnya di memori
 * sampai dilepas. Grid library bisa berisi ratusan kartu yang di-scroll
 * berkali-kali, jadi pelepasannya tidak boleh diserahkan ke pemanggil: yang
 * lama dibuang setiap kali sumbernya berganti, dan yang terakhir dibuang saat
 * komponennya dilepas.
 */
export function useCover(source: () => string | null | undefined): CoverState {
  const src = ref('')
  const failed = ref(false)
  let current = ''

  function release(): void {
    releaseCover(current)
    current = ''
  }

  watch(
    source,
    (value) => {
      release()
      src.value = ''
      failed.value = !value

      if (!value) return
      const requested = value

      void coverUrl(value)
        .then((url) => {
          // Sumbernya bisa sudah berganti selagi gambar diambil; hasil yang
          // basi harus dilepas, bukan dipasang.
          if (source() !== requested) {
            releaseCover(url)
            return
          }
          current = url
          src.value = url
        })
        .catch(() => {
          if (source() === requested) failed.value = true
        })
    },
    { immediate: true },
  )

  onScopeDispose(release)

  return { src, failed }
}
