import type { HttpClient, HttpHeaders } from '@mirai/extension-api'

/**
 * Nama header dinormalkan ke huruf kecil sebelum sampai ke extension. Native,
 * proxy, dan fetch browser tidak sepakat soal kapitalisasi, dan penulis
 * extension tidak boleh dipaksa menebak.
 */
export function lowercaseHeaders(headers: Record<string, string | undefined>): HttpHeaders {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) result[key.toLowerCase()] = value
  }
  return result
}

/**
 * Pembatas laju per host. Satu extension yang membanjiri situs sumber bisa
 * membuat seluruh pengguna Mirai kena blokir IP, jadi remnya dipasang di host —
 * bukan dititipkan ke kode pihak ketiga.
 */
export function withRateLimit(client: HttpClient, perSecond: number): HttpClient {
  const minGap = 1000 / perSecond
  const nextFree = new Map<string, number>()

  async function throttle(url: string): Promise<void> {
    let host: string
    try {
      host = new URL(url).host
    } catch {
      host = url
    }

    const now = Date.now()
    const earliest = Math.max(now, nextFree.get(host) ?? 0)
    nextFree.set(host, earliest + minGap)
    if (earliest > now) await new Promise((resolve) => setTimeout(resolve, earliest - now))
  }

  return {
    ...client,
    async request(req) {
      await throttle(req.url)
      return client.request(req)
    },
    async get(url, headers) {
      await throttle(url)
      return client.get(url, headers)
    },
    async post(url, body, headers) {
      await throttle(url)
      return client.post(url, body, headers)
    },
    async getJson(url, headers) {
      await throttle(url)
      return client.getJson(url, headers)
    },
  }
}
