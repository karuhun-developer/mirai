import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { SEntry } from '@mirai/extension-api'
import type { RemoteSource } from '@mirai/extension-runtime'
import type { EntryRow } from '@mirai/db'
import { migrateEntry, searchCandidates, type MigrationResult } from '@/services/migrate.service'
import { challengeOf, type ChallengeInfo } from '@/services/challenge.service'

/**
 * Alur "pindahkan judul ini ke source lain".
 *
 * Dipisah dari store entri karena hidupnya lebih pendek dari halamannya: yang
 * disimpan di sini cuma isi dialog yang sedang terbuka, dan begitu migrasinya
 * jadi, halaman entrilah yang berpindah — bukan store ini yang menyusul.
 */
export const useMigrateStore = defineStore('migrate', () => {
  const candidates = ref<SEntry[]>([])
  const searching = ref(false)
  const running = ref(false)
  const error = ref<string | null>(null)
  const challenge = ref<ChallengeInfo | null>(null)
  /**
   * Id source yang terakhir dicari — idnya, bukan objeknya. Pinia membuka
   * bungkus setiap ref di state-nya secara dalam, dan sebuah `RemoteSource`
   * yang lewat di sana kehilangan kanal RPC-nya: yang tersisa objek biasa yang
   * tidak bisa dipanggil lagi.
   */
  const targetId = ref<string | null>(null)

  function reset(): void {
    candidates.value = []
    searching.value = false
    running.value = false
    error.value = null
    challenge.value = null
    targetId.value = null
  }

  function fail(cause: unknown): void {
    const blocked = challengeOf(cause)
    if (blocked) challenge.value = blocked
    else error.value = cause instanceof Error ? cause.message : String(cause)
  }

  async function search(source: RemoteSource, title: string): Promise<void> {
    if (searching.value) return
    searching.value = true
    error.value = null
    challenge.value = null
    targetId.value = source.id
    candidates.value = []

    try {
      candidates.value = await searchCandidates(source, title)
    } catch (cause) {
      fail(cause)
    } finally {
      searching.value = false
    }
  }

  /**
   * Mengembalikan hasilnya, bukan menyimpannya: yang memanggil perlu langsung
   * berpindah ke entri baru, dan hasil yang mengendap di store cuma menunggu
   * dipakai dialog berikutnya untuk judul yang sama sekali berbeda.
   */
  async function run(
    from: EntryRow,
    source: RemoteSource,
    entry: SEntry,
    removeOld: boolean,
  ): Promise<MigrationResult | null> {
    if (running.value) return null
    running.value = true
    error.value = null
    challenge.value = null

    try {
      return await migrateEntry(from, source, entry, { removeOld })
    } catch (cause) {
      fail(cause)
      return null
    } finally {
      running.value = false
    }
  }

  return { candidates, searching, running, error, challenge, targetId, reset, search, run }
})
