import { describe, expect, it } from 'vitest'
import { compact, mapLimit, parseIsoDate, parseNumber, query } from '../src/util.js'

describe('util', () => {
  it('membuang parameter kosong dari query string', () => {
    expect(query({ limit: 20, offset: 0, title: '', order: undefined })).toBe('?limit=20&offset=0')
  })

  it('mengembalikan string kosong kalau tidak ada parameter tersisa', () => {
    expect(query({ title: '' })).toBe('')
  })

  it('membaca nomor chapter berkoma maupun bertitik', () => {
    expect(parseNumber('Chapter 12.5')).toBe(12.5)
    expect(parseNumber('Chapter 12,5')).toBe(12.5)
  })

  it('mengembalikan undefined untuk judul tanpa angka, bukan nol', () => {
    // Nol akan mengacaukan pengurutan; undefined memberi tahu host harus
    // memakai urutan asli dari source.
    expect(parseNumber('Oneshot')).toBeUndefined()
  })

  it('membaca ISO 8601 dan menolak tanggal cacat', () => {
    expect(parseIsoDate('2024-05-01T00:00:00+00:00')).toBe(Date.parse('2024-05-01T00:00:00Z'))
    expect(parseIsoDate('bukan tanggal')).toBeUndefined()
    expect(parseIsoDate(undefined)).toBeUndefined()
  })

  it('membuang properti undefined tapi mempertahankan nilai falsy yang sah', () => {
    expect(compact({ a: 1, b: undefined, c: '', d: 0, e: false })).toEqual({
      a: 1,
      c: '',
      d: 0,
      e: false,
    })
  })

  it('menjaga urutan hasil meski konkurensi dibatasi', async () => {
    const order: number[] = []
    const result = await mapLimit([5, 1, 4, 2, 3], 2, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, item))
      order.push(item)
      return item * 10
    })

    expect(result).toEqual([50, 10, 40, 20, 30])
    // Selesainya memang tidak berurutan — itu buktinya benar-benar paralel.
    expect(order).not.toEqual([5, 1, 4, 2, 3])
  })

  it('menerima daftar kosong tanpa menggantung', async () => {
    await expect(mapLimit([], 4, async () => 1)).resolves.toEqual([])
  })
})
