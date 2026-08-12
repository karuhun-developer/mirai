import type { HttpClient, HttpHeaders, HttpRequest, HttpResponse } from '@mirai/extension-api'
import { HttpError } from '@mirai/extension-api'

/**
 * Transport untuk build web. Browser tidak bisa menembus CORS situs sumber,
 * jadi semua request menempuh `apps/proxy`. Proxy tidak menyimpan apa pun; ia
 * meneruskan byte dan memasang header CORS, dengan allowlist host + gerbang
 * SSRF karena URL-nya dikendalikan kode extension.
 */
export function createProxyHttpClient(proxyUrl: string): HttpClient {
  const base = proxyUrl.replace(/\/+$/, '')

  /** Membaca `{ error }` dari respons proxy; jatuh ke statusText kalau gagal. */
  async function detailOf(response: Response): Promise<string> {
    const raw = await response.text().catch(() => '')
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && 'error' in parsed) {
        return String((parsed as { error: unknown }).error)
      }
    } catch {
      // Bukan JSON — pakai apa adanya.
    }
    return raw || response.statusText
  }

  async function request(req: HttpRequest): Promise<HttpResponse> {
    let response: Response
    try {
      response = await fetch(`${base}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
    } catch {
      // Proxy-nya sendiri tidak terjangkau. Ini masalah setup, bukan masalah
      // situs sumber, jadi pesannya harus menyebut proxy dan alamatnya.
      throw new HttpError(0, req.url, `Proxy di ${base} tidak bisa dihubungi. Sudah dijalankan?`)
    }

    if (!response.ok) {
      const detail = await detailOf(response)
      // Tiga kegagalan yang berbeda sering tertukar: kebijakan proxy (403),
      // situs sumber tidak terjangkau (502), dan respons kegedean (413).
      // Menyamakannya bikin user mengutak-atik hal yang salah.
      const reason =
        response.status === 403
          ? `Ditolak kebijakan proxy: ${detail}`
          : response.status === 502
            ? `Sumber tidak bisa dihubungi lewat proxy: ${detail}`
            : `Proxy gagal (${response.status}): ${detail}`
      throw new HttpError(response.status, req.url, reason)
    }

    return (await response.json()) as HttpResponse
  }

  return {
    request,
    get: (url, headers) => request(headers ? { url, headers } : { url }),
    post: (url, body, headers) =>
      request(headers ? { url, method: 'POST', body, headers } : { url, method: 'POST', body }),
    async getJson(url: string, headers?: HttpHeaders): Promise<unknown> {
      const res = await request(headers ? { url, headers } : { url })
      if (!res.ok) throw new HttpError(res.status, res.url)
      return JSON.parse(res.body) as unknown
    },
  }
}

/**
 * Gambar dan video tidak lewat RPC — terlalu besar untuk dipindah sebagai
 * string. Yang dibutuhkan cuma URL yang bisa dipasang ke `<img>`/`<video>`.
 */
export interface MediaResolver {
  toDisplayUrl(url: string, headers?: HttpHeaders): string
}

/** Di native, URL asli langsung dipakai; WebView tidak menahan pemuatan media. */
export const directMediaResolver: MediaResolver = {
  toDisplayUrl: (url) => url,
}

export function createProxyMediaResolver(proxyUrl: string): MediaResolver {
  const base = proxyUrl.replace(/\/+$/, '')
  return {
    toDisplayUrl(url, headers) {
      const search = new URLSearchParams({ url })
      // Header dititipkan sebagai satu parameter JSON supaya `Referer` yang
      // diminta CDN tetap ikut tanpa memaksa proxy menebaknya.
      if (headers && Object.keys(headers).length > 0) {
        search.set('headers', JSON.stringify(headers))
      }
      return `${base}/stream?${search.toString()}`
    },
  }
}
