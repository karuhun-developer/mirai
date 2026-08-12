import { describe, expect, it } from 'vitest'
import type { EntryRow, ItemRow } from '@mirai/db'
import {
  entryDir,
  fingerprint,
  itemDir,
  pageFileName,
  safeSegment,
} from '../src/services/downloadPath.ts'

function entry(overrides: Partial<EntryRow> = {}): EntryRow {
  return {
    id: 'komikcast::https://komikcast.li/manga/one-piece/',
    kind: 'manga',
    source_id: 'komikcast',
    url: 'https://komikcast.li/manga/one-piece/',
    title: 'One Piece',
    thumbnail_url: null,
    author: null,
    artist: null,
    description: null,
    genre: null,
    status: 'ongoing',
    favorite: 1,
    added_at: 1,
    items_at: 1,
    updated_at: 1,
    ...overrides,
  } as EntryRow
}

function item(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: 'komikcast::https://komikcast.li/manga/one-piece/::https://komikcast.li/chapter-1/',
    entry_id: entry().id,
    url: 'https://komikcast.li/chapter-1/',
    name: 'Chapter 1',
    number: 1,
    date_upload: null,
    scanlator: null,
    filler: 0,
    seen: 0,
    last_position: 0,
    total_position: null,
    bookmark: 0,
    downloaded: 0,
    sort_index: 0,
    added_at: 1,
    updated_at: 1,
    ...overrides,
  } as ItemRow
}

describe('safeSegment', () => {
  it('membuang karakter yang tidak boleh jadi nama berkas', () => {
    expect(safeSegment('https://komikcast.li/manga/one-piece/')).toBe(
      'https-komikcast-li-manga-one-piece',
    )
    expect(safeSegment('Kimetsu no Yaiba: Chapter 1?')).toBe('kimetsu-no-yaiba-chapter-1')
  })

  it('memangkas nama panjang supaya tidak melewati batas sistem berkas', () => {
    expect(safeSegment('a'.repeat(200)).length).toBe(48)
  })

  it('tidak pernah mengembalikan nama kosong', () => {
    // Judul yang seluruhnya tanda baca — jarang, tapi ada di sumber Jepang.
    expect(safeSegment('！？…')).toBe('x')
  })
})

describe('fingerprint', () => {
  it('stabil untuk masukan yang sama', () => {
    expect(fingerprint('komikcast::https://a/b')).toBe(fingerprint('komikcast::https://a/b'))
  })

  it('membedakan dua id yang cuma beda di ujungnya', () => {
    expect(fingerprint('.../chapter-1/')).not.toBe(fingerprint('.../chapter-2/'))
  })

  it('selalu delapan digit heksadesimal', () => {
    expect(fingerprint('x')).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('itemDir', () => {
  it('menyusun jalur yang terbaca manusia tapi tetap unik per item', () => {
    const dir = itemDir(entry(), item())
    expect(dir.startsWith(`${entryDir(entry())}/`)).toBe(true)
    expect(dir).toMatch(/\/0001-chapter-1-[0-9a-f]{8}$/)
  })

  it('memberi nomor berpadding supaya chapter 10 tidak mendarat sebelum chapter 9', () => {
    const nine = itemDir(entry(), item({ number: 9, name: 'Chapter 9' }))
    const ten = itemDir(entry(), item({ number: 10, name: 'Chapter 10' }))
    expect([ten, nine].sort()).toEqual([nine, ten])
  })

  it('tetap memisahkan dua chapter yang namanya sama persis', () => {
    const first = itemDir(entry(), item({ id: 'a::x', name: 'Chapter 1', number: 1 }))
    const second = itemDir(entry(), item({ id: 'a::y', name: 'Chapter 1', number: 1 }))
    expect(first).not.toBe(second)
  })

  it('menerima item tanpa nomor', () => {
    expect(itemDir(entry(), item({ number: null, name: 'Oneshot' }))).toMatch(/\/0000-oneshot-/)
  })
})

describe('pageFileName', () => {
  it('memakai ekstensi dari URL dan nomor berpadding', () => {
    expect(pageFileName(0, 'https://cdn.test/01.png')).toBe('001.png')
    expect(pageFileName(11, 'https://cdn.test/12.webp')).toBe('012.webp')
  })

  it('mengabaikan query saat menebak ekstensi', () => {
    expect(pageFileName(0, 'https://cdn.test/01.jpeg?token=abc')).toBe('001.jpg')
  })

  it('jatuh ke jpg kalau URL-nya tidak menyebut ekstensi', () => {
    expect(pageFileName(2, 'https://cdn.test/image?id=3')).toBe('003.jpg')
  })
})
