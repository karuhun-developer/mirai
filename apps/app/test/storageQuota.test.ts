import { describe, expect, it } from 'vitest'
import { humanBytes, storageStatus } from '../src/services/storageQuota.ts'

const GB = 1024 * 1024 * 1024
const MB = 1024 * 1024

describe('storageStatus', () => {
  it('diam selama ruangnya masih lega', () => {
    expect(storageStatus({ used: 2 * GB, quota: 60 * GB }).level).toBe('ok')
    expect(storageStatus({ used: 2 * GB, quota: 60 * GB }).messageKey).toBeNull()
  })

  it('memperingatkan sebelum benar-benar mentok', () => {
    const status = storageStatus({ used: 58 * GB, quota: 60 * GB })
    expect(status.level).toBe('low')
    expect(status.messageKey).toBe('storage.low')
    // Angkanya ikut diuji karena kalimat peringatannya menyebut sisa ruang.
    expect(humanBytes(status.free)).toBe('2.0 GB')
  })

  it('menolak lanjut kalau sisanya tinggal sedikit', () => {
    expect(storageStatus({ used: 60 * GB - 50 * MB, quota: 60 * GB }).level).toBe('full')
  })

  it('memakai persentase di kuota besar dan angka mutlak di kuota kecil', () => {
    // 4 GB sisa dari kuota 500 GB masih di bawah 3% — sedikit, walau angkanya besar.
    expect(storageStatus({ used: 496 * GB, quota: 500 * GB }).level).toBe('full')
    // 300 MB sisa dari kuota 800 MB itu 37%, tapi tetap tidak cukup untuk satu episode.
    expect(storageStatus({ used: 500 * MB, quota: 800 * MB }).level).toBe('low')
  })

  it('menganggap kuota yang tidak diketahui sebagai lega', () => {
    expect(storageStatus(null).level).toBe('ok')
    expect(storageStatus({ used: 0, quota: 0 }).level).toBe('ok')
  })
})

describe('humanBytes', () => {
  it('menaikkan satuan dan memberi desimal cuma di angka kecil', () => {
    expect(humanBytes(900)).toBe('900 B')
    expect(humanBytes(1536)).toBe('1.5 KB')
    expect(humanBytes(120 * MB)).toBe('120 MB')
    expect(humanBytes(2.5 * GB)).toBe('2.5 GB')
  })

  it('tidak pecah kena angka aneh', () => {
    expect(humanBytes(Number.NaN)).toBe('0 B')
    expect(humanBytes(-1)).toBe('0 B')
  })
})
