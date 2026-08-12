import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { RemoteSource } from '@mirai/extension-runtime'
import { fetchRepoIndex, install, type InstalledExtension } from '@/services/extensions'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Daftar source yang siap dipakai halaman Browse.
 *
 * Fase 1 memuat seluruh isi repo pengembangan sekaligus; pemasangan per-paket,
 * enable/disable, dan penyimpanan pilihan pengguna masuk Fase 2.
 */
export const useSourcesStore = defineStore('sources', () => {
  // shallowRef, bukan ref: isinya instance kelas yang memegang Worker. Proxy
  // reaktif Vue akan membungkus method-nya dan merusak identitas objek yang
  // dikirim lewat postMessage.
  const extensions = shallowRef<InstalledExtension[]>([])
  const state = ref<LoadState>('idle')
  const error = ref<string | null>(null)

  const sources = computed<RemoteSource[]>(() =>
    extensions.value.flatMap((extension) => extension.sources),
  )

  function byId(id: string): RemoteSource | undefined {
    return sources.value.find((source) => source.id === id)
  }

  async function load(): Promise<void> {
    if (state.value === 'loading') return
    state.value = 'loading'
    error.value = null

    try {
      const index = await fetchRepoIndex()
      const settled = await Promise.allSettled(index.map(install))

      // Satu extension rusak tidak boleh mengosongkan seluruh daftar; yang
      // gagal dilaporkan, yang berhasil tetap bisa dipakai.
      const installed = settled
        .filter(
          (result): result is PromiseFulfilledResult<InstalledExtension> =>
            result.status === 'fulfilled',
        )
        .map((result) => result.value)

      const failures = settled.filter((result) => result.status === 'rejected')

      extensions.value = installed
      state.value = 'ready'
      if (failures.length > 0) {
        error.value = `${failures.length} extension gagal dimuat: ${failures
          .map((result) => (result.reason as Error).message)
          .join('; ')}`
      }
    } catch (cause) {
      state.value = 'error'
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  /** Memuat sekali per sesi; halaman boleh memanggilnya tanpa saling menunggu. */
  async function ensureLoaded(): Promise<void> {
    if (state.value === 'idle' || state.value === 'error') await load()
  }

  return { extensions, sources, state, error, byId, load, ensureLoaded }
})
