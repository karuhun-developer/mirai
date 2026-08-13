import { ref } from 'vue'
import { defineStore } from 'pinia'
import { t } from '@/i18n'
import { applyBackup, exportBackup, readBackup } from '@/services/backup.service'
import { BackupError, type BackupFile } from '@/services/backupFormat'
import { useExtensionsStore } from './extensions'
import { useLibraryStore } from './library'

/**
 * Ekspor dan impor backup.
 *
 * Restore menyentuh hampir seluruh app sekaligus, jadi urusan "siapa yang harus
 * memuat ulang setelahnya" ditaruh di sini, bukan di servis: setelah baris-baris
 * baru masuk, library harus dibaca ulang dari database dan extension harus
 * dibaca ulang dari `localStorage`. Tanpa itu, layar masih menampilkan keadaan
 * sebelum restore dan pengguna menyimpulkan backup-nya tidak jalan.
 */

export const useBackupStore = defineStore('backup', () => {
  const busy = ref(false)
  const error = ref<string | null>(null)
  const report = ref<string | null>(null)

  /** Berkas yang sudah dibaca dan menunggu konfirmasi; `null` = tidak ada. */
  const pending = ref<BackupFile | null>(null)

  async function run(work: () => Promise<string | null>): Promise<void> {
    if (busy.value) return
    busy.value = true
    error.value = null
    report.value = null
    try {
      report.value = await work()
    } catch (cause) {
      error.value = messageOf(cause)
    } finally {
      busy.value = false
    }
  }

  async function exportNow(): Promise<void> {
    await run(async () => t('settings.backup.exported', { name: await exportBackup() }))
  }

  /**
   * Membaca berkas tanpa langsung menuliskannya.
   *
   * Restore menggabungkan data ke library yang sedang dipakai dan tidak punya
   * tombol batal, jadi isinya ditunjukkan dulu — berapa entri, berapa riwayat,
   * dibuat kapan — dan pengguna yang memutuskan.
   */
  async function stage(file: File): Promise<void> {
    pending.value = null
    await run(async () => {
      pending.value = await readBackup(file)
      return null
    })
  }

  function discard(): void {
    pending.value = null
  }

  async function confirm(): Promise<void> {
    const file = pending.value
    if (!file) return

    await run(async () => {
      const { counts, extensions } = await applyBackup(file)
      pending.value = null

      await useExtensionsStore().reloadFromStorage()
      await useLibraryStore().reload()

      const extra =
        extensions.length > 0
          ? t('settings.backup.restoredExtensions', { count: extensions.length })
          : ''
      return t('settings.backup.restored', { ...counts }) + extra
    })
  }

  return { busy, error, report, pending, exportNow, stage, discard, confirm }
})

/**
 * Kegagalan membaca berkas punya sebab yang sudah dikenali; sisanya — gagal
 * menulis database, penyimpanan penuh — cuma bisa ditampilkan apa adanya.
 */
function messageOf(cause: unknown): string {
  if (cause instanceof BackupError) return t(`settings.backup.${cause.code}`, cause.params)
  return cause instanceof Error ? cause.message : String(cause)
}
