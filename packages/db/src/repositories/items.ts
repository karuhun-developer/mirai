import type { SChapter, SEpisode } from '@mirai/extension-api'
import type { EntryKind, EntryRow, ItemRow } from '../types.js'
import { toItemRow } from '../mapping.js'
import { nowMs, toFlag } from '../util.js'
import { BaseRepository } from './base.js'

/** Item beserta entri asalnya — bentuk yang dipakai Updates dan Riwayat. */
export interface ItemWithEntry extends ItemRow {
  entry_title: string
  entry_kind: EntryKind
  entry_thumbnail: string | null
  entry_url: string
  source_id: string
}

export interface SyncResult {
  total: number
  /** Item yang benar-benar baru; inilah yang muncul di Updates. */
  added: number
}

/** Kolom yang boleh disegarkan dari source; sisanya milik progres pengguna. */
const SOURCE_COLUMNS = [
  'name',
  'number',
  'date_upload',
  'scanlator',
  'filler',
  'sort_index',
  'updated_at',
] as const

const WITH_ENTRY = `
  SELECT i.*, e.title AS entry_title, e.kind AS entry_kind,
         e.thumbnail_url AS entry_thumbnail, e.url AS entry_url, e.source_id AS source_id
    FROM item i
    JOIN entry e ON e.id = i.entry_id`

export class ItemRepository extends BaseRepository<ItemRow> {
  protected readonly table = 'item'

  /**
   * Urutan bawaan: nomor terbesar di atas, seperti daftar chapter di situs
   * sumbernya. `sort_index` jadi jaring pengaman karena sebagian source tidak
   * memberi nomor sama sekali — kalau diurutkan nomornya saja, daftar itu
   * tampil acak.
   */
  listByEntry(entryId: string, descending = true): Promise<ItemRow[]> {
    const direction = descending ? 'DESC' : 'ASC'
    return this.db.query<ItemRow>(
      `SELECT * FROM item WHERE entry_id = ?
        ORDER BY number ${direction}, sort_index ${descending ? 'ASC' : 'DESC'}`,
      [entryId],
    )
  }

  /**
   * Menyatukan daftar dari source dengan yang sudah tersimpan.
   *
   * Item yang hilang dari source **tidak dihapus**: situs sering
   * menyembunyikan chapter sementara (takedown, perbaikan), dan menghapusnya
   * berarti kehilangan progres baca beserta berkas yang sudah diunduh.
   *
   * Soal `added_at`: pada sinkronisasi pertama sebuah entri, seluruh item
   * diberi waktu yang sama persis dengan `added_at` entrinya. Halaman Updates
   * menyaring `item.added_at > entry.added_at`, jadi menambahkan judul berisi
   * 300 chapter tidak menenggelamkan daftar update — sementara chapter yang
   * muncul di sinkronisasi berikutnya tetap tercatat sebagai baru.
   */
  async syncFromSource(entry: EntryRow, items: (SChapter | SEpisode)[]): Promise<SyncResult> {
    const seeding = entry.items_at === null
    // Kesamaan `added_at` itulah penanda "batch pertama", jadi sinkronisasi
    // berikutnya wajib benar-benar lebih besar. Tanpa `+ 1` sebuah entri yang
    // difavoritkan lalu disegarkan dalam milidetik yang sama menghasilkan
    // `added_at` identik, dan chapter barunya tidak pernah muncul di Updates.
    const addedAt = seeding
      ? (entry.added_at ?? nowMs())
      : Math.max(nowMs(), (entry.added_at ?? 0) + 1)

    return this.db.transaction(async (tx) => {
      const repo = new ItemRepository(tx)
      const existing = new Set(
        (await tx.query<{ id: string }>('SELECT id FROM item WHERE entry_id = ?', [entry.id])).map(
          (row) => row.id,
        ),
      )

      let added = 0
      for (const [index, source] of items.entries()) {
        const row = { ...toItemRow(entry, source, index), added_at: addedAt }
        if (!existing.has(row.id)) added += 1
        await repo.upsert(row, SOURCE_COLUMNS)
      }

      await tx.run('UPDATE entry SET items_at = ?, updated_at = ? WHERE id = ?', [
        nowMs(),
        nowMs(),
        entry.id,
      ])

      return { total: items.length, added }
    })
  }

  async markSeen(ids: string[], seen: boolean): Promise<void> {
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(', ')
    await this.db.run(`UPDATE item SET seen = ?, updated_at = ? WHERE id IN (${placeholders})`, [
      toFlag(seen),
      nowMs(),
      ...ids,
    ])
    await this.persisted(undefined)
  }

  async markEntrySeen(entryId: string, seen: boolean): Promise<void> {
    await this.db.run('UPDATE item SET seen = ?, updated_at = ? WHERE entry_id = ?', [
      toFlag(seen),
      nowMs(),
      entryId,
    ])
    await this.persisted(undefined)
  }

  /**
   * Menyimpan posisi baca/tonton. Item ditandai selesai oleh pemanggil, bukan
   * di sini: ambang "sudah dibaca" berbeda antara halaman terakhir manga dan
   * beberapa menit terakhir sebuah episode.
   */
  async setProgress(id: string, position: number, total?: number): Promise<void> {
    await this.db.run(
      `UPDATE item SET last_position = ?, total_position = COALESCE(?, total_position),
              updated_at = ? WHERE id = ?`,
      [position, total ?? null, nowMs(), id],
    )
    await this.persisted(undefined)
  }

  async setBookmark(id: string, bookmark: boolean): Promise<void> {
    await this.update(id, { bookmark: toFlag(bookmark) })
  }

  /**
   * Menandai item punya berkas lokal.
   *
   * Kolomnya ada di `item`, bukan cuma di `download`, karena yang paling sering
   * bertanya adalah daftar chapter dan saringan library — dan keduanya sudah
   * membaca `item`. Menanyakannya lewat join ke antrean berarti setiap baris
   * daftar membayar satu join demi satu tanda centang.
   */
  async setDownloaded(ids: string[], downloaded: boolean): Promise<void> {
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(', ')
    await this.db.run(
      `UPDATE item SET downloaded = ?, updated_at = ? WHERE id IN (${placeholders})`,
      [toFlag(downloaded), nowMs(), ...ids],
    )
    await this.persisted(undefined)
  }

  /** Item yang berkasnya ada di perangkat — dasar pembersihan dan hitungan. */
  listDownloaded(entryId?: string): Promise<ItemRow[]> {
    return entryId === undefined
      ? this.db.query<ItemRow>('SELECT * FROM item WHERE downloaded = 1')
      : this.db.query<ItemRow>('SELECT * FROM item WHERE downloaded = 1 AND entry_id = ?', [
          entryId,
        ])
  }

  unreadCount(entryId: string): Promise<number> {
    return this.count('entry_id = ? AND seen = 0', [entryId])
  }

  /** Item berikutnya yang belum dibaca — tombol "Lanjutkan" di halaman detail. */
  async nextUnseen(entryId: string): Promise<ItemRow | undefined> {
    const rows = await this.db.query<ItemRow>(
      `SELECT * FROM item WHERE entry_id = ? AND seen = 0
        ORDER BY number ASC, sort_index DESC LIMIT 1`,
      [entryId],
    )
    return rows[0]
  }

  withEntry(id: string): Promise<ItemWithEntry | undefined> {
    return this.db
      .query<ItemWithEntry>(`${WITH_ENTRY} WHERE i.id = ?`, [id])
      .then((rows) => rows[0])
  }

  /**
   * Daftar Updates: item yang muncul setelah entrinya masuk library. Yang tidak
   * difavoritkan tidak ikut — Updates adalah kabar tentang koleksi sendiri,
   * bukan tentang seluruh katalog yang pernah dibuka.
   */
  recentUpdates(limit = 200): Promise<ItemWithEntry[]> {
    return this.db.query<ItemWithEntry>(
      `${WITH_ENTRY}
        WHERE e.favorite = 1 AND e.added_at IS NOT NULL AND i.added_at > e.added_at
        ORDER BY i.added_at DESC, i.number DESC
        LIMIT ?`,
      [limit],
    )
  }
}
