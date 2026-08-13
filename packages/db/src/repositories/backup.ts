import { persist } from '../db.js'
import type {
  CategoryRow,
  Db,
  EntryCategoryRow,
  EntryRow,
  HistoryRow,
  ItemRow,
  SettingRow,
} from '../types.js'

/**
 * Menyalin isi database keluar dan memasukkannya kembali.
 *
 * Yang diekspor **bukan** seluruh tabel, dan itu keputusan sadar: tabel `entry`
 * dan `item` juga menampung hasil penjelajahan katalog — entri yang cuma sempat
 * dilihat sekali dan daftar chapter yang bisa diambil ulang kapan saja dari
 * sumbernya. Membawa semuanya membuat berkas backup berlipat ganda tanpa
 * menyelamatkan satu pun hal yang benar-benar hilang kalau perangkatnya hilang.
 *
 * Yang disalin adalah yang **tidak bisa didapat lagi dari mana pun**: judul yang
 * dipilih masuk library, kategori beserta isinya, progres baca/tonton, dan
 * riwayat.
 *
 * `download` sengaja tidak ikut sama sekali. Isinya menunjuk direktori di
 * perangkat ini; di perangkat lain barisnya akan mengaku punya berkas yang tidak
 * ada.
 */

export interface DbSnapshot {
  entry: EntryRow[]
  category: CategoryRow[]
  entry_category: EntryCategoryRow[]
  item: ItemRow[]
  history: HistoryRow[]
  setting: SettingRow[]
}

/** Apa saja yang benar-benar masuk saat restore; dipakai UI untuk melapor. */
export interface RestoreCount {
  entries: number
  categories: number
  items: number
  history: number
  settings: number
}

/**
 * Entri yang layak dibawa: yang ada di library, atau yang pernah dibuka.
 * Riwayat sebuah judul yang tidak difavoritkan tetap riwayat — membuangnya
 * berarti "terakhir dibaca" kosong di perangkat baru padahal datanya ada.
 */
const ENTRY_FILTER = 'favorite = 1 OR id IN (SELECT entry_id FROM history)'

/**
 * Item yang layak dibawa: yang membawa keadaan buatan pengguna. Daftar chapter
 * lengkapnya akan datang lagi sendiri begitu entri dibuka di perangkat baru.
 */
const ITEM_FILTER =
  'seen = 1 OR last_position > 0 OR bookmark = 1 OR id IN (SELECT item_id FROM history)'

export class BackupRepository {
  constructor(private readonly db: Db) {}

  async dump(): Promise<DbSnapshot> {
    const entry = await this.db.query<EntryRow>(
      `SELECT * FROM entry WHERE ${ENTRY_FILTER} ORDER BY id`,
    )
    const category = await this.db.query<CategoryRow>(
      'SELECT * FROM category ORDER BY kind, sort_order',
    )
    const entry_category = await this.db.query<EntryCategoryRow>(
      `SELECT * FROM entry_category
       WHERE entry_id IN (SELECT id FROM entry WHERE ${ENTRY_FILTER})
       ORDER BY entry_id, category_id`,
    )
    const item = await this.db.query<ItemRow>(
      `SELECT * FROM item
       WHERE entry_id IN (SELECT id FROM entry WHERE ${ENTRY_FILTER}) AND (${ITEM_FILTER})
       ORDER BY entry_id, sort_index`,
    )
    const history = await this.db.query<HistoryRow>('SELECT * FROM history ORDER BY read_at DESC')
    const setting = await this.db.query<SettingRow>('SELECT * FROM setting ORDER BY key')

    return { entry, category, entry_category, item, history, setting }
  }

  /**
   * Menggabungkan snapshot ke database yang sudah ada — tidak pernah mengosongkan
   * apa pun lebih dulu.
   *
   * Alasannya: restore paling sering dipakai untuk memindahkan library ke
   * perangkat kedua yang sudah berisi sesuatu, dan "impor" yang diam-diam
   * menghapus adalah cara tercepat kehilangan data yang tidak ada backup-nya.
   * Baris yang bentrok dimenangkan data yang masuk — itu yang diminta orang saat
   * menekan "Pulihkan".
   *
   * Seluruhnya satu transaksi: backup yang gagal di tengah tidak boleh
   * meninggalkan setengah library beserta riwayat yang menggantung.
   */
  async restore(snapshot: DbSnapshot): Promise<RestoreCount> {
    return this.db
      .transaction(async (tx) => {
        // Urutannya mengikuti foreign key, dan FK memang menyala di kedua driver.
        // Kategori dulu supaya `entry_category` punya kedua sisinya; item sebelum
        // history karena `history.item_id` menunjuk ke sana.
        for (const row of snapshot.category) await upsert(tx, 'category', ['id'], row)
        for (const row of snapshot.entry) await upsert(tx, 'entry', ['id'], row)

        const entries = new Set(snapshot.entry.map((row) => row.id))
        const categories = new Set(snapshot.category.map((row) => row.id))

        // Baris penghubung yang salah satu sisinya tidak ikut terbawa dibuang
        // diam-diam. Alternatifnya adalah seluruh restore gagal karena satu
        // kategori yang hilang di berkas backup yang sudah tua.
        for (const row of snapshot.entry_category) {
          if (!entries.has(row.entry_id) || !categories.has(row.category_id)) continue
          await upsert(tx, 'entry_category', ['entry_id', 'category_id'], row)
        }

        for (const row of snapshot.item) {
          if (!entries.has(row.entry_id)) continue
          // `downloaded` tidak pernah ikut menyeberang: berkasnya ada di perangkat
          // asal, dan tanda yang bohong membuat reader membuka direktori kosong.
          await upsert(tx, 'item', ['id'], { ...row, downloaded: 0 })
        }

        const items = new Set(snapshot.item.map((row) => row.id))
        for (const row of snapshot.history) {
          if (!items.has(row.item_id) || !entries.has(row.entry_id)) continue
          await upsert(tx, 'history', ['item_id'], row)
        }

        for (const row of snapshot.setting) await upsert(tx, 'setting', ['key'], row)

        return {
          entries: snapshot.entry.length,
          categories: snapshot.category.length,
          items: snapshot.item.filter((row) => entries.has(row.entry_id)).length,
          history: snapshot.history.filter((row) => items.has(row.item_id)).length,
          settings: snapshot.setting.length,
        }
      })
      .finally(() => persist())
  }
}

/**
 * `INSERT … ON CONFLICT DO UPDATE` dengan kunci yang ditentukan pemanggil.
 *
 * Bukan `INSERT OR REPLACE`: itu menghapus baris lama lebih dulu, dan
 * penghapusan itu memicu `ON DELETE CASCADE` — mengganti satu entri akan ikut
 * membuang seluruh chapter dan riwayatnya, termasuk yang baru saja dimasukkan.
 */
async function upsert(
  db: Db,
  table: string,
  keys: readonly string[],
  input: object,
): Promise<void> {
  // Baris apa pun boleh masuk: kolomnya dibaca dari objeknya, bukan dari daftar
  // yang ditulis tangan. Cast-nya perlu karena tipe baris adalah interface, dan
  // interface tidak punya index signature — padahal kunci-kuncinya persis nama
  // kolom yang ingin dibaca di sini.
  const row = input as Record<string, unknown>
  const columns = Object.keys(row)
  const updates = columns.filter((column) => !keys.includes(column))

  await db.run(
    `INSERT INTO ${table} (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})
     ON CONFLICT(${keys.join(', ')}) ${
       updates.length === 0
         ? 'DO NOTHING'
         : `DO UPDATE SET ${updates.map((column) => `${column} = excluded.${column}`).join(', ')}`
     }`,
    columns.map((column) => row[column]),
  )
}
