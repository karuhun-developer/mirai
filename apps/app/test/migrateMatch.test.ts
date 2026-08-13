import { describe, expect, it } from 'vitest'
import type { ItemRow } from '@mirai/db'
import { pairByNumber } from '../src/services/migrateMatch.ts'

/** Baris item secukupnya; kolom yang tidak diuji diisi nilai netral. */
function item(patch: Partial<ItemRow> & Pick<ItemRow, 'id'>): ItemRow {
  return {
    entry_id: 'entry',
    url: `/${patch.id}`,
    name: patch.id,
    number: null,
    date_upload: null,
    scanlator: null,
    filler: 0,
    seen: 0,
    last_position: 0,
    total_position: null,
    bookmark: 0,
    downloaded: 0,
    sort_index: 0,
    added_at: 0,
    updated_at: 0,
    ...patch,
  }
}

describe('pairByNumber', () => {
  it('memasangkan chapter dengan nomor yang sama walau judulnya berbeda', () => {
    const pairs = pairByNumber(
      [item({ id: 'lama-12', number: 12, name: 'Chapter 12', seen: 1 })],
      [item({ id: 'baru-12', number: 12, name: 'Ch. 12 — Pulang' })],
    )
    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.next.id).toBe('baru-12')
  })

  it('melewati item yang belum pernah disentuh', () => {
    const pairs = pairByNumber(
      [item({ id: 'lama-1', number: 1 })],
      [item({ id: 'baru-1', number: 1 })],
    )
    expect(pairs).toEqual([])
  })

  it('ikut memindahkan penanda dan posisi walau belum tandai selesai', () => {
    const pairs = pairByNumber(
      [
        item({ id: 'lama-3', number: 3, last_position: 14 }),
        item({ id: 'lama-4', number: 4, bookmark: 1 }),
      ],
      [item({ id: 'baru-3', number: 3 }), item({ id: 'baru-4', number: 4 })],
    )
    expect(pairs.map((pair) => pair.next.id)).toEqual(['baru-3', 'baru-4'])
  })

  it('tidak menebak lewat urutan waktu nomornya kosong', () => {
    const pairs = pairByNumber(
      [item({ id: 'lama-x', seen: 1 })],
      [item({ id: 'baru-x', number: 1 })],
    )
    expect(pairs).toEqual([])
  })

  it('membiarkan chapter yang tidak ada di source baru tertinggal', () => {
    const pairs = pairByNumber(
      [item({ id: 'lama-7', number: 7, seen: 1 }), item({ id: 'lama-8', number: 8, seen: 1 })],
      [item({ id: 'baru-7', number: 7 })],
    )
    expect(pairs.map((pair) => pair.old.id)).toEqual(['lama-7'])
  })

  it('memakai yang teratas kalau source baru punya nomor kembar', () => {
    const pairs = pairByNumber(
      [item({ id: 'lama-5', number: 5, seen: 1 })],
      [item({ id: 'baru-5a', number: 5 }), item({ id: 'baru-5b', number: 5 })],
    )
    expect(pairs[0]?.next.id).toBe('baru-5a')
  })
})
