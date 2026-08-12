import type { RemoteSource } from '@mirai/extension-runtime'
import type { EntryKind, EntryRow, ItemWithEntry } from '@mirai/db'
import { repos } from './db.service'
import { refreshEntry } from './entry.service'

/**
 * Updates: chapter dan episode yang muncul setelah judulnya masuk library.
 *
 * Penyegarannya sengaja berurutan satu per satu, bukan paralel. Transport sudah
 * membatasi laju per host, tapi memuat 200 judul sekaligus tetap berarti 200
 * Worker call yang menumpuk dan UI yang tidak bisa melaporkan sampai mana
 * prosesnya. Berurutan juga membuat tombol Batal punya arti.
 */

export interface RefreshProgress {
  done: number
  total: number
  /** Judul yang sedang diperiksa; ditampilkan di bilah progres. */
  title: string
}

export interface RefreshFailure {
  title: string
  message: string
}

export interface RefreshReport {
  checked: number
  /** Total item baru yang ditemukan di seluruh library. */
  added: number
  /** Judul yang dilewati karena extension sumbernya tidak terpasang/aktif. */
  skipped: string[]
  failures: RefreshFailure[]
}

export type SourceLookup = (sourceId: string) => RemoteSource | undefined

export function listUpdates(limit = 200): Promise<ItemWithEntry[]> {
  return repos().items.recentUpdates(limit)
}

export function favorites(kind?: EntryKind): Promise<EntryRow[]> {
  return repos().entries.list({
    where: kind ? 'favorite = 1 AND kind = ?' : 'favorite = 1',
    params: kind ? [kind] : [],
    orderBy: 'title COLLATE NOCASE ASC',
  })
}

export interface RefreshOptions {
  /** Membatasi penyegaran ke satu jenis; halaman Library memakai ini. */
  kind?: EntryKind
  onProgress?: (progress: RefreshProgress) => void
  /** Dipanggil sebelum tiap judul; `false` menghentikan sisa antrean. */
  shouldContinue?: () => boolean
}

export async function refreshLibrary(
  resolve: SourceLookup,
  options: RefreshOptions = {},
): Promise<RefreshReport> {
  const list = await favorites(options.kind)
  const report: RefreshReport = { checked: 0, added: 0, skipped: [], failures: [] }

  for (const [index, entry] of list.entries()) {
    if (options.shouldContinue?.() === false) break
    options.onProgress?.({ done: index, total: list.length, title: entry.title })

    const source = resolve(entry.source_id)
    if (!source) {
      // Extension bisa dicopot sementara entrinya tetap di library. Itu bukan
      // error — judulnya tetap terbaca offline, cuma tidak bisa disegarkan.
      report.skipped.push(entry.title)
      continue
    }

    try {
      const result = await refreshEntry(source, entry)
      report.added += result.added
      report.checked += 1
    } catch (cause) {
      report.failures.push({
        title: entry.title,
        message: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  options.onProgress?.({ done: list.length, total: list.length, title: '' })
  return report
}
