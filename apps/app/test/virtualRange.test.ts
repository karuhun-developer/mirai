import { describe, expect, it } from 'vitest'
import { rowRange } from '../src/composables/virtualRange.ts'

/** Ukuran yang gampang dihitung di kepala: 100 baris setinggi 10px. */
const base = { rows: 100, rowHeight: 10, viewport: 100, overscan: 0 }

describe('rowRange', () => {
  it('merender dari baris pertama selama daftarnya belum tergulung', () => {
    expect(rowRange({ ...base, scrolled: 0 })).toEqual({
      start: 0,
      end: 10,
      padTop: 0,
      padBottom: 900,
    })
  })

  it('menggeser jendela mengikuti gulungan, dengan padding yang menggantikannya', () => {
    const range = rowRange({ ...base, scrolled: 300 })
    expect(range.start).toBe(30)
    expect(range.padTop).toBe(300)
    expect(range.padTop + (range.end - range.start) * 10 + range.padBottom).toBe(1000)
  })

  it('menjaga tinggi total tetap sama di posisi mana pun', () => {
    for (const scrolled of [0, 55, 400, 990]) {
      const range = rowRange({ ...base, scrolled, overscan: 3 })
      expect(range.padTop + (range.end - range.start) * 10 + range.padBottom).toBe(1000)
    }
  })

  it('tidak memotong apa pun selama daftarnya masih di bawah layar', () => {
    // `scrolled` negatif: headernya masih di atas daftar.
    expect(rowRange({ ...base, scrolled: -250 }).start).toBe(0)
  })

  it('menambah baris cadangan di kedua sisi jendela', () => {
    const range = rowRange({ ...base, scrolled: 300, overscan: 3 })
    expect(range.start).toBe(27)
    expect(range.end).toBe(43)
  })

  it('berhenti di baris terakhir, tidak melewatinya', () => {
    const range = rowRange({ ...base, scrolled: 900, overscan: 3 })
    expect(range.end).toBe(100)
    expect(range.padBottom).toBe(0)
  })

  it('tetap menyisakan satu baris waktu gulungan tertinggal di luar daftar', () => {
    // Daftarnya menyusut (filter, judul dihapus) sementara halaman masih
    // tergulung jauh ke bawah — paddingnya tidak boleh jadi negatif.
    const range = rowRange({ rows: 5, rowHeight: 10, viewport: 100, scrolled: 5_000 })
    expect(range.start).toBeLessThan(range.end)
    expect(range.padBottom).toBeGreaterThanOrEqual(0)
    expect(range.padTop).toBeLessThanOrEqual(50)
  })

  it('tidak merender apa pun waktu daftarnya kosong', () => {
    expect(rowRange({ ...base, rows: 0, scrolled: 0 })).toEqual({
      start: 0,
      end: 0,
      padTop: 0,
      padBottom: 0,
    })
  })

  it('bertahan waktu tinggi barisnya belum sempat diukur', () => {
    expect(rowRange({ ...base, rowHeight: 0, scrolled: 0 }).end).toBe(0)
  })
})
