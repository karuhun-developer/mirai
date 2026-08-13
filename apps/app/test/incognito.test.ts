import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Mode incognito hanya berguna kalau tidak ada satu pun jalur yang lolos, dan
 * jalur itu tersebar di reader, pemutar, dan tombol "tandai sudah dibaca".
 * Yang diuji di sini gerbangnya sendiri — `recordHistory()` — karena di situlah
 * semuanya bertemu.
 */

const record = vi.fn(async () => {})

vi.mock('../src/services/db.service.ts', () => ({
  repos: () => ({ history: { record } }),
}))

const { recordHistory } = await import('../src/services/history.service.ts')
const { settings } = await import('../src/services/settings.service.ts')

describe('recordHistory', () => {
  beforeEach(() => {
    record.mockClear()
    settings.incognito = false
  })

  it('mencatat seperti biasa waktu incognito mati', async () => {
    await recordHistory('item-1', 'entry-1', 12)
    expect(record).toHaveBeenCalledWith('item-1', 'entry-1', 12)
  })

  it('tidak menyentuh database sama sekali waktu incognito menyala', async () => {
    settings.incognito = true
    await recordHistory('item-1', 'entry-1', 12)
    expect(record).not.toHaveBeenCalled()
  })

  it('kembali mencatat begitu incognito dimatikan', async () => {
    settings.incognito = true
    await recordHistory('item-1', 'entry-1', 12)
    settings.incognito = false
    await recordHistory('item-2', 'entry-1', 3)
    expect(record).toHaveBeenCalledTimes(1)
    expect(record).toHaveBeenCalledWith('item-2', 'entry-1', 3)
  })
})
