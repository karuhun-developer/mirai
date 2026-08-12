import { describe, expect, it } from 'vitest'
import type { HttpClient, HttpResponse } from '@mirai/extension-api'
import { CloudflareChallengeError, HttpError } from '@mirai/extension-api'
import { isCloudflareChallenge, withCloudflareDetection } from '../src/http/cloudflare.ts'
import { withUserAgent } from '../src/http/shared.ts'
import { serializeError } from '../src/protocol.ts'

function response(over: Partial<HttpResponse> = {}): HttpResponse {
  return {
    url: 'https://kunmanga.com/manga/?m_orderby=views',
    status: 200,
    ok: true,
    headers: {},
    body: '<html></html>',
    ...over,
  }
}

/** Bentuk yang benar-benar dikirim kunmanga.com per 2026-08-12. */
const challenge = response({
  status: 403,
  ok: false,
  headers: { server: 'cloudflare', 'cf-mitigated': 'challenge', 'cf-ray': '9a1b2c3d4e5f' },
  body: '<title>Just a moment...</title><script>window.__cf_chl_opt={}</script>',
})

describe('deteksi tantangan Cloudflare', () => {
  it('mengenali managed challenge', () => {
    expect(isCloudflareChallenge(challenge)).toBe(true)
  })

  it('mengenali IUAM lama yang hanya punya penanda badan', () => {
    const iuam = response({
      status: 503,
      ok: false,
      headers: { server: 'cloudflare' },
      body: '<div id="cf-browser-verification">…</div>',
    })
    expect(isCloudflareChallenge(iuam)).toBe(true)
  })

  it('403 biasa dari situs ber-Cloudflare tetap error biasa', () => {
    // Ini yang membedakan "extension salah alamat" dari "manusianya dibutuhkan";
    // menyamakannya akan memunculkan tombol verifikasi untuk hal yang tidak bisa
    // diselesaikan siapa pun.
    const forbidden = response({
      status: 403,
      ok: false,
      headers: { server: 'cloudflare' },
      body: '{"error":"forbidden"}',
    })
    expect(isCloudflareChallenge(forbidden)).toBe(false)
  })

  it('halaman 200 yang memuat kata kunci bukan tantangan', () => {
    const article = response({ body: 'Judul bab: Just a moment' })
    expect(isCloudflareChallenge(article)).toBe(false)
  })

  it('penanda badan tanpa bukti Cloudflare diabaikan', () => {
    const impostor = response({ status: 403, ok: false, body: 'Just a moment' })
    expect(isCloudflareChallenge(impostor)).toBe(false)
  })
})

describe('withCloudflareDetection', () => {
  const client = withCloudflareDetection({
    request: () => Promise.resolve(challenge),
    get: () => Promise.resolve(challenge),
    post: () => Promise.resolve(challenge),
    getJson: () => Promise.resolve({}),
  } as HttpClient)

  it('melempar CloudflareChallengeError dengan origin sebagai halaman tantangan', async () => {
    await expect(client.get('https://kunmanga.com/manga/?m_orderby=views')).rejects.toThrow(
      CloudflareChallengeError,
    )
    const error = await client.request({ url: challenge.url }).catch((e: unknown) => e)
    expect((error as CloudflareChallengeError).challengeUrl).toBe('https://kunmanga.com')
  })

  it('getJson ikut diperiksa, tidak gagal sebagai JSON rusak', async () => {
    await expect(client.getJson('https://kunmanga.com/api')).rejects.toThrow(
      CloudflareChallengeError,
    )
  })

  it('respons non-2xx biasa tetap jadi HttpError, bukan JSON kosong', async () => {
    const plain = withCloudflareDetection({
      get: () => Promise.resolve(response({ status: 404, ok: false, body: 'nope' })),
    } as unknown as HttpClient)
    await expect(plain.getJson('https://example.com/x')).rejects.toThrow(HttpError)
  })

  it('challengeUrl selamat melintas RPC', () => {
    // Error ini menyeberang dua batas worker; kalau propertinya tidak ikut,
    // UI cuma punya teks pesan dan tombol verifikasi tidak pernah muncul.
    const serialized = serializeError(
      new CloudflareChallengeError(403, challenge.url, 'https://kunmanga.com'),
    )
    expect(serialized.status).toBe(403)
    expect(serialized.challengeUrl).toBe('https://kunmanga.com')
    expect(serializeError(Object.assign(new Error('x'), serialized)).challengeUrl).toBe(
      'https://kunmanga.com',
    )
  })
})

describe('withUserAgent', () => {
  function spy(): { client: HttpClient; seen: (Record<string, string> | undefined)[] } {
    const seen: (Record<string, string> | undefined)[] = []
    const client: HttpClient = {
      request: (req) => {
        seen.push(req.headers as Record<string, string> | undefined)
        return Promise.resolve(response())
      },
      get: (_url, headers) => {
        seen.push(headers as Record<string, string> | undefined)
        return Promise.resolve(response())
      },
      post: () => Promise.resolve(response()),
      getJson: () => Promise.resolve({}),
    }
    return { client, seen }
  }

  it('nilai kosong tidak menyentuh header extension', async () => {
    const { client, seen } = spy()
    await withUserAgent(client, () => '').get('https://x.test', { 'User-Agent': 'asli' })
    expect(seen[0]).toEqual({ 'User-Agent': 'asli' })
  })

  it('menimpa UA yang sudah ada tanpa menyisakan duplikat', async () => {
    const { client, seen } = spy()
    await withUserAgent(client, () => 'Mirai/1.0').get('https://x.test', {
      'user-agent': 'asli',
      Referer: 'https://x.test/',
    })
    expect(seen[0]).toEqual({ Referer: 'https://x.test/', 'User-Agent': 'Mirai/1.0' })
  })

  it('dibaca ulang tiap request supaya setelan baru langsung berlaku', async () => {
    const { client, seen } = spy()
    let agent = 'pertama'
    const wrapped = withUserAgent(client, () => agent)
    await wrapped.request({ url: 'https://x.test' })
    agent = 'kedua'
    await wrapped.request({ url: 'https://x.test' })
    expect(seen.map((h) => h?.['User-Agent'])).toEqual(['pertama', 'kedua'])
  })
})
