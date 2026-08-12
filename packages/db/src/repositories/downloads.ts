import { persist } from '../db.js'
import type { Db, DownloadRow, DownloadState, EntryKind } from '../types.js'
import { nowMs } from '../util.js'

/** Satu baris antrean beserta apa yang perlu ditampilkan di daftarnya. */
export interface DownloadEntry extends DownloadRow {
  item_name: string
  item_number: number | null
  entry_title: string
  entry_kind: EntryKind
  entry_thumbnail: string | null
}

/**
 * Antrean unduhan.
 *
 * Kuncinya `item_id`, bukan id acak: satu chapter cuma boleh punya satu
 * unduhan. Kalau id-nya dibikin baru tiap kali tombol ditekan, menekan dua kali
 * berarti dua pekerjaan menulis ke direktori yang sama persis — dan yang kedua
 * merusak yang pertama. `INSERT ... ON CONFLICT DO UPDATE` membuat penekanan
 * kedua berarti "coba lagi", yang memang yang dimaksud orang.
 *
 * Yang disimpan di sini cuma **keadaan** pekerjaannya. Berkas hasilnya tinggal
 * di Filesystem/OPFS dengan `path` sebagai penunjuk — memasukkan gambar ke
 * SQLite membuat database membengkak sampai tidak bisa dibuka, pelajaran mahal
 * dari tabel `media` di POS Kacaw.
 */
export class DownloadRepository {
  constructor(private readonly db: Db) {}

  private async persisted(): Promise<void> {
    if (!this.db.inTransaction) await persist()
  }

  /**
   * Memasukkan (atau mengulang) satu pekerjaan.
   *
   * Pekerjaan yang sudah `done` sengaja **tidak** dikembalikan ke antrean:
   * chapter yang berkasnya sudah lengkap tidak perlu diunduh lagi cuma karena
   * tombolnya tersentuh. Yang gagal, terjeda, atau masih berjalan boleh diulang
   * — progres dan pesan errornya dibersihkan supaya tidak menampilkan angka
   * percobaan sebelumnya.
   */
  async enqueue(itemId: string, entryId: string): Promise<void> {
    const now = nowMs()
    await this.db.run(
      `INSERT INTO download (id, item_id, entry_id, state, progress, path, error, created_at, updated_at)
       VALUES (?, ?, ?, 'queued', 0, NULL, NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         state = CASE WHEN download.state = 'done' THEN 'done' ELSE 'queued' END,
         progress = CASE WHEN download.state = 'done' THEN download.progress ELSE 0 END,
         error = NULL,
         updated_at = excluded.updated_at`,
      [itemId, itemId, entryId, now, now],
    )
    await this.persisted()
  }

  async byItem(itemId: string): Promise<DownloadRow | undefined> {
    const rows = await this.db.query<DownloadRow>('SELECT * FROM download WHERE id = ?', [itemId])
    return rows[0]
  }

  /**
   * Pekerjaan berikutnya yang boleh dimulai.
   *
   * Urutannya waktu masuk, bukan nomor chapter: orang yang mengantre satu judul
   * lalu judul lain mengharapkan yang pertama selesai lebih dulu. `running`
   * tidak ikut terambil — yang mengurus jumlah pekerja adalah antreannya, dan
   * mengambil baris yang sedang jalan berarti mengunduhnya dua kali.
   */
  async nextQueued(): Promise<DownloadRow | undefined> {
    const rows = await this.db.query<DownloadRow>(
      `SELECT * FROM download WHERE state = 'queued' ORDER BY created_at, id LIMIT 1`,
    )
    return rows[0]
  }

  /**
   * Daftar untuk halaman Unduhan: yang belum selesai lebih dulu, lalu yang
   * sudah, masing-masing terbaru di atas.
   */
  list(limit = 200): Promise<DownloadEntry[]> {
    return this.db.query<DownloadEntry>(
      `SELECT d.*, i.name AS item_name, i.number AS item_number,
              e.title AS entry_title, e.kind AS entry_kind, e.thumbnail_url AS entry_thumbnail
         FROM download d
         JOIN item i ON i.id = d.item_id
         JOIN entry e ON e.id = d.entry_id
        ORDER BY CASE d.state WHEN 'done' THEN 1 ELSE 0 END, d.created_at DESC
        LIMIT ?`,
      [limit],
    )
  }

  /** Id item yang berkasnya sudah lengkap — dipakai menandai baris di daftar. */
  async doneItemIds(entryId: string): Promise<string[]> {
    const rows = await this.db.query<{ item_id: string }>(
      `SELECT item_id FROM download WHERE entry_id = ? AND state = 'done'`,
      [entryId],
    )
    return rows.map((row) => row.item_id)
  }

  countPending(): Promise<number> {
    return this.countWhere(`state IN ('queued', 'running')`)
  }

  async setState(
    id: string,
    state: DownloadState,
    patch: Partial<DownloadRow> = {},
  ): Promise<void> {
    await this.db.run(
      `UPDATE download
          SET state = ?,
              progress = COALESCE(?, progress),
              path = COALESCE(?, path),
              error = ?,
              updated_at = ?
        WHERE id = ?`,
      [state, patch.progress ?? null, patch.path ?? null, patch.error ?? null, nowMs(), id],
    )
    await this.persisted()
  }

  /**
   * Progres ditulis tanpa `persist()`.
   *
   * Angka ini berubah tiap satu halaman selesai — menyimpan snapshot database
   * sesering itu berarti menulis ulang seluruh berkas SQLite puluhan kali per
   * chapter, dan di web itu terasa sebagai app yang tersendat. Nilai yang
   * sungguh penting (selesai/gagal) lewat `setState()`, yang menyimpan.
   */
  async setProgress(id: string, progress: number): Promise<void> {
    await this.db.run('UPDATE download SET progress = ?, updated_at = ? WHERE id = ?', [
      Math.max(0, Math.min(100, Math.round(progress))),
      nowMs(),
      id,
    ])
  }

  /**
   * Pekerjaan yang tertinggal `running` waktu aplikasi ditutup.
   *
   * Tidak ada proses yang mengerjakannya lagi setelah tab ditutup atau aplikasi
   * dibunuh sistem, jadi barisnya akan menggantung selamanya kalau tidak
   * dipulangkan ke `queued` saat aplikasi dibuka lagi. Dipanggil sekali di awal.
   */
  async requeueRunning(): Promise<void> {
    await this.db.run(
      `UPDATE download SET state = 'queued', updated_at = ? WHERE state = 'running'`,
      [nowMs()],
    )
    await this.persisted()
  }

  /** Menjeda semua yang belum selesai; yang sedang jalan berhenti di halaman berikutnya. */
  async pauseAll(): Promise<void> {
    await this.db.run(
      `UPDATE download SET state = 'paused', updated_at = ? WHERE state IN ('queued', 'running')`,
      [nowMs()],
    )
    await this.persisted()
  }

  /** Melanjutkan yang terjeda maupun yang gagal — satu tombol, seperti harapan orang. */
  async resumeAll(): Promise<void> {
    await this.db.run(
      `UPDATE download SET state = 'queued', error = NULL, updated_at = ?
        WHERE state IN ('paused', 'failed')`,
      [nowMs()],
    )
    await this.persisted()
  }

  async remove(id: string): Promise<void> {
    await this.db.run('DELETE FROM download WHERE id = ?', [id])
    await this.persisted()
  }

  async removeMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(', ')
    await this.db.run(`DELETE FROM download WHERE id IN (${placeholders})`, ids)
    await this.persisted()
  }

  /** Membersihkan daftar dari yang sudah selesai. Berkasnya tidak ikut terhapus. */
  async clearDone(): Promise<void> {
    await this.db.run(`DELETE FROM download WHERE state = 'done'`)
    await this.persisted()
  }

  private async countWhere(where: string, params: unknown[] = []): Promise<number> {
    const rows = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM download WHERE ${where}`,
      params,
    )
    return rows[0]?.total ?? 0
  }
}
