import { describe, expect, it } from 'vitest'
import { TriState } from '@mirai/extension-api'
import {
  checkboxValue,
  findFilter,
  group,
  options,
  select,
  selectedOption,
  textFilter,
  textValue,
  triState,
  triStatePartition,
} from '../src/filters.js'

describe('filter', () => {
  const list = [
    textFilter('q', 'Kata kunci'),
    select('order', 'Urutkan', options('populer', 'terbaru'), 1),
    group('genre', 'Genre', [
      triState('action', 'Action', TriState.Include),
      triState('ecchi', 'Ecchi', TriState.Exclude),
      triState('drama', 'Drama'),
    ]),
  ]

  it('menemukan filter di dalam group', () => {
    expect(findFilter(list, 'ecchi')?.name).toBe('Ecchi')
  })

  it('mengembalikan undefined untuk key yang tidak dikenal, bukan melempar', () => {
    // Filter tersimpan dari versi extension lama boleh hilang tanpa merusak pencarian.
    expect(findFilter(list, 'sudah-dihapus')).toBeUndefined()
    expect(selectedOption(list, 'sudah-dihapus')).toBeUndefined()
    expect(textValue(list, 'sudah-dihapus')).toBe('')
    expect(checkboxValue(list, 'sudah-dihapus')).toBe(false)
  })

  it('membaca opsi terpilih berdasarkan indeks', () => {
    expect(selectedOption(list, 'order')?.value).toBe('terbaru')
  })

  it('memisahkan tri-state jadi disertakan dan dikecualikan, mengabaikan yang netral', () => {
    expect(triStatePartition(list, 'genre')).toEqual({
      included: ['action'],
      excluded: ['ecchi'],
    })
  })

  it('mengembalikan partisi kosong kalau key bukan group', () => {
    expect(triStatePartition(list, 'q')).toEqual({ included: [], excluded: [] })
  })
})
