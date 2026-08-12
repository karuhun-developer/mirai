import { describe, expect, it } from 'vitest'
import type { SChapter, SManga } from '@mirai/extension-api'
import { createSqlJsDb } from '../src/drivers/sqljs.js'
import { runMigrations } from '../src/migrations.js'
import { EntryRepository } from '../src/repositories/entries.js'
import { ItemRepository } from '../src/repositories/items.js'
import { CategoryRepository } from '../src/repositories/categories.js'
import { HistoryRepository } from '../src/repositories/history.js'
import { SettingsRepository } from '../src/repositories/settings.js'
import { entryId } from '../src/util.js'
import type { Db, EntryRow } from '../src/types.js'

/**
 * Database uji berjalan di `sql.js` yang sama persis dengan build web, cuma
 * tanpa snapshot — jadi yang diuji di sini adalah SQL dan aturan yang
 * sesungguhnya dipakai, bukan tiruan.
 */
async function openDb(): Promise<Db> {
  const handle = await createSqlJsDb()
  await runMigrations(handle.db)
  return handle.db
}

function manga(url: string, title: string, extra: Partial<SManga> = {}): SManga {
  return { url, title, ...extra }
}

function chapter(url: string, name: string, number: number): SChapter {
  return { url, name, chapterNumber: number }
}

async function favorite(entries: EntryRepository, row: EntryRow): Promise<EntryRow> {
  const saved = await entries.setFavorite(row.id, true)
  if (!saved) throw new Error('entri tidak ditemukan setelah difavoritkan')
  return saved
}

describe('migrasi', () => {
  it('membuat seluruh tabel dan aman dijalankan dua kali', async () => {
    const db = await openDb()
    await runMigrations(db)

    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
    const names = tables.map((row) => row.name)

    expect(names).toEqual(
      expect.arrayContaining([
        'category',
        'download',
        'entry',
        'entry_category',
        'history',
        'item',
        'schema_migrations',
        'setting',
      ]),
    )

    const applied = await db.query<{ version: number }>('SELECT version FROM schema_migrations')
    expect(applied).toHaveLength(1)
  })
})

describe('transaksi', () => {
  it('membatalkan seluruh perubahan kalau ada yang gagal', async () => {
    const db = await openDb()
    const entries = new EntryRepository(db)

    await expect(
      db.transaction(async (tx) => {
        await new EntryRepository(tx).saveCatalogue('manga', 'src', [manga('/a', 'A')])
        throw new Error('gagal di tengah jalan')
      }),
    ).rejects.toThrow('gagal di tengah jalan')

    expect(await entries.count()).toBe(0)
  })

  it('transaksi bersarang ikut transaksi yang sedang berjalan', async () => {
    const db = await openDb()

    await db.transaction(async (tx) => {
      expect(tx.inTransaction).toBe(true)
      await tx.transaction(async (inner) => {
        expect(inner).toBe(tx)
        await inner.run('INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?)', [
          'nested',
          'ya',
          1,
        ])
      })
    })

    expect(await new SettingsRepository(db).get('nested')).toBe('ya')
  })

  it('dua transaksi yang dimulai berbarengan tidak saling menimpa', async () => {
    const db = await openDb()
    const settings = new SettingsRepository(db)

    await Promise.all([
      db.transaction((tx) => new SettingsRepository(tx).set('a', '1')),
      db.transaction((tx) => new SettingsRepository(tx).set('b', '2')),
    ])

    expect(await settings.get('a')).toBe('1')
    expect(await settings.get('b')).toBe('2')
  })
})

describe('entri', () => {
  it('menyegarkan katalog tanpa menghapus favorit dan detail', async () => {
    const db = await openDb()
    const entries = new EntryRepository(db)

    const [first] = await entries.saveCatalogue('manga', 'src', [manga('/naruto', 'Naruto')])
    if (!first) throw new Error('katalog kosong')

    await favorite(entries, first)
    await entries.saveDetails('manga', 'src', {
      ...manga('/naruto', 'Naruto'),
      description: 'Ninja',
      genre: ['Action', 'Shounen'],
      status: 'completed',
    })

    // Kunjungan berikutnya ke halaman Browse: judul boleh berubah, sisanya tidak.
    await entries.saveCatalogue('manga', 'src', [manga('/naruto', 'Naruto (Remaster)')])

    const saved = await entries.findById(entryId('src', '/naruto'))
    expect(saved?.title).toBe('Naruto (Remaster)')
    expect(saved?.favorite).toBe(1)
    expect(saved?.description).toBe('Ninja')
    expect(saved?.added_at).not.toBeNull()
  })

  it('mempertahankan added_at saat favorit dicabut lalu dipasang lagi', async () => {
    const db = await openDb()
    const entries = new EntryRepository(db)
    const [row] = await entries.saveCatalogue('manga', 'src', [manga('/a', 'A')])
    if (!row) throw new Error('katalog kosong')

    const added = (await favorite(entries, row)).added_at
    await entries.setFavorite(row.id, false)
    const again = await entries.setFavorite(row.id, true)

    expect(again?.added_at).toBe(added)
  })

  it('membuang entri katalog yang tidak difavoritkan dan tanpa progres', async () => {
    const db = await openDb()
    const entries = new EntryRepository(db)
    const rows = await entries.saveCatalogue('manga', 'src', [manga('/a', 'A'), manga('/b', 'B')])
    const keep = rows[0]
    if (!keep) throw new Error('katalog kosong')

    await favorite(entries, keep)
    expect(await entries.pruneOrphans()).toBe(1)
    expect(await entries.count()).toBe(1)
  })
})

describe('item', () => {
  async function seeded(): Promise<{
    db: Db
    entries: EntryRepository
    items: ItemRepository
    entry: EntryRow
  }> {
    const db = await openDb()
    const entries = new EntryRepository(db)
    const items = new ItemRepository(db)
    const [row] = await entries.saveCatalogue('manga', 'src', [manga('/a', 'A')])
    if (!row) throw new Error('katalog kosong')
    return { db, entries, items, entry: await favorite(entries, row) }
  }

  it('sinkronisasi pertama tidak dihitung sebagai update', async () => {
    const { entries, items, entry } = await seeded()

    const result = await items.syncFromSource(entry, [
      chapter('/a/1', 'Chapter 1', 1),
      chapter('/a/2', 'Chapter 2', 2),
    ])

    expect(result).toEqual({ total: 2, added: 2 })
    expect(await items.recentUpdates()).toHaveLength(0)

    const refreshed = await entries.findById(entry.id)
    expect(refreshed?.items_at).not.toBeNull()
  })

  it('chapter yang muncul kemudian masuk daftar update', async () => {
    const { entries, items, entry } = await seeded()
    await items.syncFromSource(entry, [chapter('/a/1', 'Chapter 1', 1)])

    const after = await entries.findById(entry.id)
    if (!after) throw new Error('entri hilang')

    const second = await items.syncFromSource(after, [
      chapter('/a/1', 'Chapter 1', 1),
      chapter('/a/2', 'Chapter 2', 2),
    ])

    expect(second.added).toBe(1)
    const updates = await items.recentUpdates()
    expect(updates).toHaveLength(1)
    expect(updates[0]?.name).toBe('Chapter 2')
    expect(updates[0]?.entry_title).toBe('A')
  })

  it('menyegarkan daftar tidak menghapus progres baca', async () => {
    const { entries, items, entry } = await seeded()
    await items.syncFromSource(entry, [chapter('/a/1', 'Chapter 1', 1)])

    const id = `${entry.id}::/a/1`
    await items.markSeen([id], true)
    await items.setProgress(id, 12, 20)

    const after = await entries.findById(entry.id)
    if (!after) throw new Error('entri hilang')
    // Judul chapter diperbaiki di sisi source; progresnya tidak ikut berubah.
    await items.syncFromSource(after, [chapter('/a/1', 'Chapter 01', 1)])

    const item = await items.findById(id)
    expect(item?.name).toBe('Chapter 01')
    expect(item?.seen).toBe(1)
    expect(item?.last_position).toBe(12)
    expect(item?.total_position).toBe(20)
  })

  it('item yang hilang dari source tetap disimpan', async () => {
    const { entries, items, entry } = await seeded()
    await items.syncFromSource(entry, [chapter('/a/1', 'Chapter 1', 1)])
    const after = await entries.findById(entry.id)
    if (!after) throw new Error('entri hilang')

    await items.syncFromSource(after, [])
    expect(await items.count('entry_id = ?', [entry.id])).toBe(1)
  })

  it('menunjuk item berikutnya yang belum dibaca', async () => {
    const { items, entry } = await seeded()
    await items.syncFromSource(entry, [
      chapter('/a/1', 'Chapter 1', 1),
      chapter('/a/2', 'Chapter 2', 2),
      chapter('/a/3', 'Chapter 3', 3),
    ])
    await items.markSeen([`${entry.id}::/a/1`], true)

    expect((await items.nextUnseen(entry.id))?.name).toBe('Chapter 2')
    expect(await items.unreadCount(entry.id)).toBe(2)
  })

  it('menghapus entri ikut menghapus item dan riwayatnya', async () => {
    const { db, entries, items, entry } = await seeded()
    await items.syncFromSource(entry, [chapter('/a/1', 'Chapter 1', 1)])
    await new HistoryRepository(db).record(`${entry.id}::/a/1`, entry.id, 3)

    await entries.remove(entry.id)

    expect(await items.count()).toBe(0)
    expect(await new HistoryRepository(db).recent()).toHaveLength(0)
  })
})

describe('library', () => {
  it('menghitung belum dibaca, menyaring kategori, dan mengurutkan', async () => {
    const db = await openDb()
    const entries = new EntryRepository(db)
    const items = new ItemRepository(db)
    const categories = new CategoryRepository(db)

    const rows = await entries.saveCatalogue('manga', 'src', [
      manga('/a', 'Alpha'),
      manga('/b', 'Beta'),
    ])
    const [alpha, beta] = rows
    if (!alpha || !beta) throw new Error('katalog kosong')
    await favorite(entries, alpha)
    await favorite(entries, beta)

    await items.syncFromSource(alpha, [chapter('/a/1', 'C1', 1), chapter('/a/2', 'C2', 2)])
    await items.markSeen([`${alpha.id}::/a/1`], true)

    const sedang = await categories.create('Sedang dibaca', 'manga')
    await categories.setForEntry(alpha.id, [sedang.id])

    const all = await entries.library({ kind: 'manga' })
    expect(all.map((row) => row.title)).toEqual(['Alpha', 'Beta'])
    expect(all[0]?.unread).toBe(1)

    expect(await entries.library({ kind: 'manga', categoryId: sedang.id })).toHaveLength(1)
    expect(
      (await entries.library({ kind: 'manga', categoryId: null })).map((row) => row.title),
    ).toEqual(['Beta'])
    expect(await entries.library({ kind: 'manga', unreadOnly: true })).toHaveLength(1)
    expect(await entries.library({ kind: 'manga', search: 'bet' })).toHaveLength(1)
    expect(
      (await entries.library({ kind: 'manga', sort: 'title', descending: true })).map(
        (row) => row.title,
      ),
    ).toEqual(['Beta', 'Alpha'])
    expect(await entries.library({ kind: 'anime' })).toHaveLength(0)
    expect(await categories.counts('manga')).toEqual({ [sedang.id]: 1 })
  })

  it('mengganti kategori satu entri sekaligus', async () => {
    const db = await openDb()
    const entries = new EntryRepository(db)
    const categories = new CategoryRepository(db)
    const [row] = await entries.saveCatalogue('manga', 'src', [manga('/a', 'A')])
    if (!row) throw new Error('katalog kosong')

    const satu = await categories.create('Satu', 'manga')
    const dua = await categories.create('Dua', 'manga')

    await categories.setForEntry(row.id, [satu.id, dua.id])
    expect(await categories.forEntry(row.id)).toHaveLength(2)

    await categories.setForEntry(row.id, [dua.id])
    expect((await categories.forEntry(row.id)).map((item) => item.name)).toEqual(['Dua'])

    // Kategori yang dihapus ikut melepaskan keanggotaannya.
    await categories.remove(dua.id)
    expect(await categories.forEntry(row.id)).toHaveLength(0)
  })
})

describe('riwayat & setelan', () => {
  it('menyimpan satu baris per item dan mengembalikan yang terbaru dulu', async () => {
    const db = await openDb()
    const entries = new EntryRepository(db)
    const items = new ItemRepository(db)
    const history = new HistoryRepository(db)

    const [row] = await entries.saveCatalogue('manga', 'src', [manga('/a', 'A')])
    if (!row) throw new Error('katalog kosong')
    const entry = await favorite(entries, row)
    await items.syncFromSource(entry, [chapter('/a/1', 'C1', 1), chapter('/a/2', 'C2', 2)])

    await history.record(`${entry.id}::/a/1`, entry.id, 1)
    await history.record(`${entry.id}::/a/2`, entry.id, 5)
    await history.record(`${entry.id}::/a/1`, entry.id, 9)

    // Tiga kali `record` untuk dua item = dua baris; yang kedua kalinya menimpa.
    const recent = await history.recent()
    expect(recent).toHaveLength(2)
    expect(recent.map((row) => row.item_name).sort()).toEqual(['C1', 'C2'])
    expect(recent.find((row) => row.item_name === 'C1')?.position).toBe(9)
    expect(recent[0]?.entry_title).toBe('A')

    // Urutan diuji dengan waktu yang benar-benar berbeda: tiga panggilan di
    // atas terjadi dalam milidetik yang sama, dan urutan seri memang tidak
    // dijanjikan.
    await db.run('UPDATE history SET read_at = read_at + 1000 WHERE item_id = ?', [
      `${entry.id}::/a/2`,
    ])
    expect((await history.recent())[0]?.item_name).toBe('C2')

    await history.clear()
    expect(await history.recent()).toHaveLength(0)
  })

  it('mengembalikan nilai bawaan kalau setelan rusak', async () => {
    const db = await openDb()
    const settings = new SettingsRepository(db)

    await settings.setJson('library.view', { sort: 'unread' })
    expect(await settings.getJson('library.view', { sort: 'title' })).toEqual({ sort: 'unread' })

    await settings.set('library.view', '{bukan json')
    expect(await settings.getJson('library.view', { sort: 'title' })).toEqual({ sort: 'title' })
  })
})
