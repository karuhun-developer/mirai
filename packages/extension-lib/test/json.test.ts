import { describe, expect, it } from 'vitest'
import { arr, bool, get, isRecord, num, str, strList } from '../src/json.js'

describe('penyempit JSON', () => {
  it('menelusuri jalur bersarang lewat objek dan array', () => {
    const payload = { data: [{ attributes: { title: { en: 'Solo Leveling' } } }] }
    expect(get(payload, 'data', 0, 'attributes', 'title', 'en')).toBe('Solo Leveling')
  })

  it('berhenti jadi undefined begitu satu ruas tidak cocok, bukan melempar', () => {
    expect(get({ data: null }, 'data', 'attributes')).toBeUndefined()
    expect(get({ data: {} }, 'data', 0)).toBeUndefined()
    expect(get(undefined, 'apa', 'saja')).toBeUndefined()
  })

  it('membedakan record dari array dan null', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
  })

  it('mengembalikan fallback untuk tipe yang salah', () => {
    expect(str(42, 'kosong')).toBe('kosong')
    expect(bool('true', false)).toBe(false)
    expect(arr('bukan array')).toEqual([])
  })

  it('membaca angka dari string tapi menolak NaN', () => {
    expect(num('12.5')).toBe(12.5)
    expect(num('abc')).toBeUndefined()
    expect(num(Number.NaN)).toBeUndefined()
  })

  it('membuang anggota non-string alih-alih ikut gagal', () => {
    expect(strList(['a', 1, null, 'b'])).toEqual(['a', 'b'])
  })
})
