import type { SEntry } from '@mirai/extension-api'
import type { RemoteSource } from '@mirai/extension-runtime'
import type { EntryRow } from '@mirai/db'
import { t } from '@/i18n'
import { repos } from './db.service'
import { idOf, refreshEntry, rememberCatalogue } from './entry.service'
import { removeEntryDownloads } from './download.service'
import { categoriesOf, setEntryCategories } from './library.service'
import { pairByNumber } from './migrateMatch'

/**
 * Memindahkan satu judul dari satu source ke source lain.
 *
 * Kenapa ini ada: source mati, ganti domain, atau kualitas terjemahannya
 * memburuk — dan yang mahal bukan judulnya (tinggal dicari lagi), melainkan
 * **jejak yang menempel padanya**: sudah baca sampai chapter berapa, penanda,
 * kategori, dan kapan terakhir dibuka. Tanpa migrasi, pindah source berarti
 * memulai judul dari nol dan berpura-pura belum pernah membacanya.
 *
 * Yang **tidak** ikut pindah adalah berkas unduhan. Chapter di source baru
 * halamannya berbeda — beda scanlator, beda pemotongan, kadang beda jumlah —
 * jadi menautkan berkas lama ke item baru berarti menampilkan halaman yang
 * salah dengan penuh keyakinan.
 */

export interface MigrationResult {
  /** Baris baru di library; tujuan navigasi setelah migrasi selesai. */
  entry: EntryRow
  /** Item di source baru yang menerima keadaan dari padanannya di source lama. */
  transferred: number
  /** Item yang ditemukan di source baru. */
  total: number
}

export interface MigrationOptions {
  /**
   * Menghapus entri lama beserta unduhannya. Kalau `false`, entri lama cuma
   * dicabut dari library — riwayat dan progresnya tetap ada di sana sebagai
   * jalan pulang kalau source barunya ternyata lebih buruk.
   */
  removeOld: boolean
}

/**
 * Kandidat di source tujuan. Pencarian pakai judul entri lama apa adanya:
 * itulah yang paling mungkin dikenali situs lain, dan hasilnya tetap dipilih
 * manusia — mencocokkan judul secara otomatis adalah cara memindahkan progres
 * ke judul yang salah.
 */
export async function searchCandidates(
  source: RemoteSource,
  title: string,
  limit = 12,
): Promise<SEntry[]> {
  const page = await source.getSearch(1, title, [])
  return page.entries.slice(0, limit)
}

/**
 * Menjalankan migrasi. Urutannya disengaja: entri baru disiapkan **lengkap**
 * lebih dulu, dan entri lama baru disentuh di langkah terakhir — kegagalan di
 * tengah jalan menyisakan dua judul di library, bukan nol.
 */
export async function migrateEntry(
  from: EntryRow,
  source: RemoteSource,
  target: SEntry,
  options: MigrationOptions,
): Promise<MigrationResult> {
  if (source.kind !== from.kind) {
    throw new Error(t(source.kind === 'anime' ? 'errors.sourceNotManga' : 'errors.sourceNotAnime'))
  }

  const id = idOf(source.id, target.url)
  if (id === from.id) throw new Error(t('errors.migrateSame'))

  const { entries, items, history } = repos()

  await rememberCatalogue(from.kind, source.id, [target])
  const created = await entries.findById(id)
  if (!created) throw new Error(t('errors.entryNotSaved'))

  // Daftar chapter/episode source baru wajib ada sebelum apa pun dipindahkan —
  // tanpa itu tidak ada yang bisa menerima progresnya.
  await refreshEntry(source, created)
  const fresh = (await entries.findById(id)) ?? created

  const oldItems = await items.listByEntry(from.id)
  const newItems = await items.listByEntry(fresh.id)
  const pairs = pairByNumber(oldItems, newItems)

  await items.transferState(
    pairs.map(({ old, next }) => ({
      id: next.id,
      seen: old.seen,
      last_position: old.last_position,
      total_position: old.total_position,
      bookmark: old.bookmark,
    })),
  )
  await history.transfer(
    pairs.map(({ old, next }) => ({ from: old.id, to: next.id })),
    fresh.id,
  )

  await setEntryCategories(
    fresh.id,
    (await categoriesOf(from.id)).map((category) => category.id),
  )
  await entries.setFavorite(fresh.id, true)

  if (options.removeOld) {
    // Berkasnya dihapus lebih dulu: entri yang sudah hilang dari database tidak
    // punya siapa pun yang tahu folder unduhannya ada di mana.
    await removeEntryDownloads(from).catch(() => undefined)
    await entries.remove(from.id)
  } else {
    await entries.setFavorite(from.id, false)
  }

  return {
    entry: (await entries.findById(fresh.id)) ?? fresh,
    transferred: pairs.length,
    total: newItems.length,
  }
}
