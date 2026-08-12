import { describe, expect, it } from 'vitest'
import { assertAllowed, BlockedUrlError } from '../src/guard.ts'

const guard = { allowedHosts: ['komikcast.cc', 'be.komikcast.cc'] }

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
  it('mengizinkan host yang dibatasi beserta subdomainnya', () => {
    expect(assertAllowed('https://be.komikcast.cc/api', guard).hostname).toBe('be.komikcast.cc')
    expect(assertAllowed('https://cdn.komikcast.cc/x.jpg', guard).hostname).toBe('cdn.komikcast.cc')
  })

  it('tidak tertipu host yang cuma berakhiran sama', () => {
    expect(blocked('https://notkomikcast.cc/')).toContain('tidak ada di daftar')
    expect(blocked('https://komikcast.cc.jahat.test/')).toContain('tidak ada di daftar')
  })

  it('mencocokkan pola bintang tepat satu label', () => {
    // CDN video mengganti label tengahnya beberapa hari sekali; polanya harus
    // mengikuti tanpa ikut membuka seluruh TLD.
    const wildcard = { allowedHosts: ['megap.*.top'] }
    expect(assertAllowed('https://megap.shiora.top/x/master.m3u8', wildcard).hostname).toBe(
      'megap.shiora.top',
    )
    expect(assertAllowed('https://megap.norami.top/x', wildcard).hostname).toBe('megap.norami.top')

    for (const url of ['https://megap.a.b.top/', 'https://evil.top/', 'https://xmegap.a.top/']) {
      try {
        assertAllowed(url, wildcard)
        throw new Error(`${url} seharusnya ditolak`)
      } catch (error) {
        expect(error).toBeInstanceOf(BlockedUrlError)
      }
    }
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
    expect(blocked('gopher://komikcast.cc/')).toContain('Protokol')
  })

  it('menolak URL yang tidak bisa di-parse', () => {
    expect(blocked('bukan url sama sekali')).toContain('tidak valid')
  })

  it('tanpa pembatas host, situs publik mana pun lolos', () => {
    // Pembatas host di sisi proxy tidak bisa mengikuti extension yang dipasang
    // pengguna saat app sudah jalan; memaksakannya cuma menghasilkan 403 untuk
    // situs yang sah. Batas keamanannya ada di daftar penolakan di bawah.
    for (const options of [{}, { allowedHosts: [] }]) {
      expect(assertAllowed('https://www.mangabats.com/', options).hostname).toBe(
        'www.mangabats.com',
      )
      expect(assertAllowed('https://be.komikcast.cc/api', options).hostname).toBe('be.komikcast.cc')
    }
  })

  it('gerbang alamat internal tetap jalan tanpa pembatas host', () => {
    // Yang boleh dilonggarkan cuma "situs mana yang boleh dibuka", bukan
    // "boleh mengintip jaringan tempat proxy berjalan".
    for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/', 'http://[::1]/']) {
      expect(() => assertAllowed(url, {})).toThrow(BlockedUrlError)
    }
    expect(() => assertAllowed('file:///etc/passwd', {})).toThrow(BlockedUrlError)
  })
})
