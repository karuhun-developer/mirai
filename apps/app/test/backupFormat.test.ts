import { describe, expect, it } from 'vitest'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  parseBackup,
  summarize,
} from '../src/services/backupFormat.ts'

/**
 * Yang diuji di sini adalah pembacaan berkas dari luar — satu-satunya masukan di
 * Mirai yang boleh menulis ke seluruh tabel sekaligus.
 */

function file(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: 1_700_000_000_000,
    app: '1.0.0',
    db: {
      entry: [{ id: 'a' }],
      category: [],
      entry_category: [],
      item: [],
      history: [],
      setting: [],
    },
    extensions: { repos: [], installed: [], prefs: {}, showNsfw: false },
    ...overrides,
  })
}

describe('parseBackup', () => {
  it('membaca berkas yang utuh', () => {
    const parsed = parseBackup(file())
    expect(parsed.app).toBe('1.0.0')
    expect(parsed.db.entry).toHaveLength(1)
    expect(parsed.extensions.showNsfw).toBe(false)
  })

  it('menolak yang bukan JSON', () => {
    expect(() => parseBackup('bukan json')).toThrow(/JSON/)
  })

  it('menolak JSON yang bukan backup Mirai', () => {
    expect(() => parseBackup('{"hello":"world"}')).toThrow(/bukan backup Mirai/)
    // Larik JSON juga sah sebagai JSON, dan pernah lolos ke tahap berikutnya.
    expect(() => parseBackup('[]')).toThrow(/bukan backup Mirai/)
  })

  it('menolak format yang lebih baru daripada yang dikenal', () => {
    expect(() => parseBackup(file({ version: BACKUP_VERSION + 1 }))).toThrow(/lebih baru/)
  })

  it('memaafkan tabel dan bagian yang hilang', () => {
    // Bentuk backup dari versi lama: `db` cuma punya sebagian tabel, `extensions`
    // belum ada sama sekali.
    const parsed = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, db: { entry: [{ id: 'a' }] } }),
    )
    expect(parsed.db.entry).toHaveLength(1)
    expect(parsed.db.history).toEqual([])
    expect(parsed.extensions.installed).toEqual([])
    expect(parsed.extensions.showNsfw).toBe(false)
    expect(parsed.createdAt).toBe(0)
  })

  it('membuang tabel yang bukan larik alih-alih menerimanya apa adanya', () => {
    const parsed = parseBackup(file({ db: { entry: 'bukan larik' } }))
    expect(parsed.db.entry).toEqual([])
  })

  it('membuang extension yang tidak bisa dipasang ulang', () => {
    const installed = [
      { pkg: 'utuh', repoUrl: 'https://r', entry: { file: 'utuh.js' }, enabled: true },
      { pkg: 'tanpa-entry', repoUrl: 'https://r', enabled: true },
      { repoUrl: 'https://r', entry: { file: 'x.js' } },
    ]
    const parsed = parseBackup(file({ extensions: { installed } }))
    expect(parsed.extensions.installed.map((record) => record.pkg)).toEqual(['utuh'])
  })
})

describe('backupFileName', () => {
  it('memberi nama bertanggal dengan bulan dan hari dua digit', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('mirai-backup-2026-01-05.json')
    expect(backupFileName(new Date(2026, 11, 31))).toBe('mirai-backup-2026-12-31.json')
  })
})

describe('summarize', () => {
  it('menghitung isi berkas untuk ditampilkan sebelum dipulihkan', () => {
    expect(summarize(parseBackup(file()))).toEqual({
      entries: 1,
      categories: 0,
      items: 0,
      history: 0,
      settings: 0,
      extensions: 0,
    })
  })
})
