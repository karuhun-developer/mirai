/**
 * Aritmetika jendela virtual — baris mana yang perlu ada di DOM, dan berapa
 * tinggi ruang kosong yang menggantikan sisanya.
 *
 * Dipisah dari komponennya dan bebas DOM supaya bisa diuji: salah hitung di
 * sini tidak melempar error, cuma membuat sebagian daftar tidak pernah tampil
 * atau scrollbar melompat — dua kesalahan yang sulit dikenali dari tampilannya.
 */

export interface VirtualRange {
  /** Indeks baris pertama yang dirender. */
  start: number
  /** Satu lewat indeks baris terakhir yang dirender. */
  end: number
  /** Tinggi pengganti baris di atas jendela, dalam piksel. */
  padTop: number
  /** Tinggi pengganti baris di bawah jendela, dalam piksel. */
  padBottom: number
}

export interface VirtualInput {
  /** Jumlah baris seluruhnya. */
  rows: number
  /** Tinggi satu baris termasuk jaraknya ke baris berikutnya. */
  rowHeight: number
  /**
   * Berapa piksel awal daftar sudah tergulung melewati atas layar. Negatif
   * selama daftarnya masih di bawah layar — belum ada yang perlu dipotong.
   */
  scrolled: number
  /** Tinggi area yang terlihat. */
  viewport: number
  /**
   * Baris cadangan di atas dan di bawah jendela. Tanpa ini, menggulung cepat
   * memperlihatkan ruang kosong sebelum baris berikutnya sempat dirender.
   */
  overscan?: number
}

export function rowRange({
  rows,
  rowHeight,
  scrolled,
  viewport,
  overscan = 3,
}: VirtualInput): VirtualRange {
  if (rows <= 0 || rowHeight <= 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 }

  const above = Math.max(0, scrolled)
  const first = Math.floor(above / rowHeight)
  const last = Math.ceil((above + Math.max(0, viewport)) / rowHeight)

  // `start` ikut dijepit ke jumlah baris: menggulung ke bawah lalu daftarnya
  // menyusut (filter, hapus judul) meninggalkan posisi jauh di luar isinya, dan
  // padding negatif membuat halaman melompat, bukan sekadar kosong.
  const start = Math.min(Math.max(0, first - overscan), Math.max(0, rows - 1))
  const end = Math.min(rows, Math.max(start + 1, last + overscan))

  return {
    start,
    end,
    padTop: start * rowHeight,
    padBottom: (rows - end) * rowHeight,
  }
}
