import { CapacitorHttp } from '@capacitor/core'
import type { HttpClient, HttpHeaders, HttpRequest, HttpResponse } from '@mirai/extension-api'
import { HttpError } from '@mirai/extension-api'
import { lowercaseHeaders } from './shared.js'

/**
 * Transport untuk APK. `CapacitorHttp` menjalankan request di sisi native, jadi
 * CORS tidak berlaku dan header seperti Referer/User-Agent benar-benar terkirim
 * — dua hal yang bikin scraping mustahil kalau lewat WebView biasa.
 */
export function createCapacitorHttpClient(): HttpClient {
  async function request(req: HttpRequest): Promise<HttpResponse> {
    const response = await CapacitorHttp.request({
      url: req.url,
      method: req.method ?? 'GET',
      headers: { ...req.headers },
      data: req.body,
      // Tanpa ini plugin mencoba mem-parse JSON sendiri dan menelan body asli;
      // parsing adalah urusan extension, bukan transport.
      responseType: 'text',
      connectTimeout: req.timeout ?? 30_000,
      readTimeout: req.timeout ?? 30_000,
    })

    const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)

    return {
      url: response.url ?? req.url,
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      headers: lowercaseHeaders(response.headers),
      body,
    }
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
