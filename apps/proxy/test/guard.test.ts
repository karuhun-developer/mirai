import { describe, expect, it } from 'vitest'
import { assertAllowed, BlockedUrlError } from '../src/guard.ts'

const guard = { allowedHosts: ['mangadex.org', 'api.mangadex.org'] }

function blocked(url: string): string {
  try {
    assertAllowed(url, guard)
  } catch (error) {
    if (error instanceof BlockedUrlError) return error.message
    throw error
  }
  throw new Error(`${url} seharusnya ditolak`)
}

describe('gerbang SSRF', () => {
  it('mengizinkan host di allowlist beserta subdomainnya', () => {
    expect(assertAllowed('https://api.mangadex.org/manga', guard).hostname).toBe('api.mangadex.org')
    expect(assertAllowed('https://uploads.mangadex.org/covers/x.jpg', guard).hostname).toBe(
      'uploads.mangadex.org',
    )
  })

  it('tidak tertipu host yang cuma berakhiran sama', () => {
    expect(blocked('https://notmangadex.org/')).toContain('allowlist')
    expect(blocked('https://mangadex.org.jahat.test/')).toContain('allowlist')
  })

  it('menolak alamat loopback dan jaringan privat', () => {
    for (const url of [
      'http://localhost:5432/',
      'http://127.0.0.1/',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
      'http://172.16.0.1/',
      'http://0.0.0.0/',
    ]) {
      expect(blocked(url)).toContain('internal')
    }
  })

  it('menolak metadata cloud di 169.254.169.254', () => {
    // Satu request ke sini cukup untuk membocorkan kredensial instance.
    expect(blocked('http://169.254.169.254/latest/meta-data/')).toContain('internal')
  })

  it('menolak loopback dan alamat privat IPv6, termasuk bentuk IPv4-mapped', () => {
    expect(blocked('http://[::1]/')).toContain('internal')
    expect(blocked('http://[fd00::1]/')).toContain('internal')
    expect(blocked('http://[fe80::1]/')).toContain('internal')
    // `new URL()` menormalkan bentuk titik jadi heksa (`::ffff:7f00:1`), jadi
    // pemeriksaan yang cuma mengenali notasi titik akan meleset.
    expect(blocked('http://[::ffff:127.0.0.1]/')).toContain('internal')
    expect(blocked('http://[::ffff:c0a8:1]/')).toContain('internal')
  })

  it('menolak IPv4 yang ditulis dalam bentuk desimal atau heksa', () => {
    // `new URL()` menormalkan keduanya jadi 127.0.0.1 sebelum sampai ke guard.
    expect(blocked('http://2130706433/')).toContain('internal')
    expect(blocked('http://0x7f000001/')).toContain('internal')
  })

  it('menolak protokol selain http dan https', () => {
    expect(blocked('file:///etc/passwd')).toContain('Protokol')
    expect(blocked('gopher://mangadex.org/')).toContain('Protokol')
  })

  it('menolak URL yang tidak bisa di-parse', () => {
    expect(blocked('bukan url sama sekali')).toContain('tidak valid')
  })

  it('gagal tertutup: allowlist kosong menolak semuanya', () => {
    // Proxy yang ter-deploy tanpa konfigurasi harus jadi tembok, bukan open relay.
    expect(() => assertAllowed('https://mangadex.org/', { allowedHosts: [] })).toThrow(
      BlockedUrlError,
    )
  })
})
