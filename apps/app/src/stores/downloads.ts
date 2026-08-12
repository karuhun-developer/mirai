import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RemoteSource } from '@mirai/extension-runtime'
import type { DownloadEntry, DownloadRow, EntryRow, ItemRow } from '@mirai/db'
import {
  bootDownloads,
  clearDone,
  configureDownloads,
  defaultDownloadPrefs,
  enqueue,
  listDownloads,
  pauseAll,
  removeDownload,
  removeEntryDownloads,
  removeJob,
  resumeAll,
  retry,
  writeDownloadPrefs,
  type DownloadPrefs,
} from '@/services/download.service'

/**
 * Wajah reaktif antrean unduhan.
 *
 * Store ini **tidak** memiliki antreannya — pekerjanya hidup di
 * `download.service.ts` supaya unduhan jalan terus walau halaman Unduhan sudah
 * ditutup. Yang di sini cuma cerminan isi database, disegarkan tiap kali
 * layanan memberi kabar.
 */
export const useDownloadsStore = defineStore('downloads', () => {
  const jobs = ref<DownloadEntry[]>([])
  const prefs = ref<DownloadPrefs>({ ...defaultDownloadPrefs })
  const error = ref<string | null>(null)

  let booted = false
  let scheduled = false

  /** Pekerjaan per chapter — dipakai daftar chapter untuk menampilkan progresnya. */
  const byItem = computed(() => new Map(jobs.value.map((job) => [job.item_id, job])))

  const active = computed(() => jobs.value.filter((job) => job.state !== 'done'))
  const finished = computed(() => jobs.value.filter((job) => job.state === 'done'))
  const working = computed(
    () => jobs.value.filter((job) => job.state === 'queued' || job.state === 'running').length,
  )
  /** Ada yang tertahan dan tidak satu pun sedang jalan — tombolnya jadi "Lanjutkan". */
  const halted = computed(() => active.value.length > 0 && working.value === 0)

  async function refresh(): Promise<void> {
    try {
      jobs.value = await listDownloads()
      error.value = null
    } catch (cause) {
      error.value = messageOf(cause)
    }
  }

  /**
   * Menyegarkan paling cepat sekali per 400 ms.
   *
   * Layanan memberi kabar tiap satu halaman selesai; menyegarkan langsung
   * berarti satu query daftar untuk tiap gambar yang turun. Seperempat detik
   * masih terasa seketika bagi yang menonton bilah progresnya.
   */
  function schedule(): void {
    if (scheduled) return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      void refresh()
    }, 400)
  }

  /**
   * Dinyalakan sekali dari shell aplikasi, bukan dari halaman Unduhan: unduhan
   * yang tertinggal dari sesi sebelumnya harus lanjut sendiri walau yang dibuka
   * halaman Library.
   */
  async function boot(resolve: (sourceId: string) => RemoteSource | undefined): Promise<void> {
    if (booted) return
    booted = true

    configureDownloads({ resolve, onChange: schedule })
    await bootDownloads()
    await refresh()
  }

  async function download(items: ItemRow[]): Promise<void> {
    try {
      await enqueue(items)
    } catch (cause) {
      error.value = messageOf(cause)
    }
    await refresh()
  }

  async function pause(): Promise<void> {
    await pauseAll()
    await refresh()
  }

  async function resume(): Promise<void> {
    await resumeAll()
    await refresh()
  }

  async function retryJob(job: DownloadRow): Promise<void> {
    await retry(job)
    await refresh()
  }

  async function discard(job: DownloadRow): Promise<void> {
    await removeJob(job)
    await refresh()
  }

  async function remove(entry: EntryRow, item: ItemRow): Promise<void> {
    await removeDownload(entry, item)
    await refresh()
  }

  async function removeEntry(entry: EntryRow): Promise<void> {
    await removeEntryDownloads(entry)
    await refresh()
  }

  async function clearFinished(): Promise<void> {
    await clearDone()
    await refresh()
  }

  async function setPrefs(patch: Partial<DownloadPrefs>): Promise<void> {
    prefs.value = await writeDownloadPrefs(patch)
  }

  return {
    jobs,
    prefs,
    error,
    byItem,
    active,
    finished,
    working,
    halted,
    boot,
    refresh,
    download,
    pause,
    resume,
    retryJob,
    discard,
    remove,
    removeEntry,
    clearFinished,
    setPrefs,
  }
})

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
