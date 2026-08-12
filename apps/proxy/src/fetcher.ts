import { assertAllowed, BlockedUrlError, MAX_REDIRECTS, type GuardOptions } from './guard.ts'

export interface UpstreamRequest {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
}

/** Header hop-by-hop tidak boleh diteruskan; sisanya milik permintaan asli. */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'origin',
  'cookie2',
  'transfer-encoding',
  'upgrade',
])

const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
  'content-encoding',
  'content-length',
  'set-cookie',
  'access-control-allow-origin',
])

export function sanitizeRequestHeaders(headers: Record<string, string> = {}): Headers {
  const result = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    if (STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) continue
    result.set(key, value)
  }
  return result
}

export function sanitizeResponseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    if (STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) return
    result[key.toLowerCase()] = value
  })
  return result
}

/**
 * Mengikuti redirect secara manual. `redirect: 'follow'` bawaan `fetch` akan
 * dengan senang hati mendarat di alamat internal — tiap lompatan harus lewat
 * gerbang yang sama dengan lompatan pertama.
 */
export async function fetchGuarded(
  request: UpstreamRequest,
  guard: GuardOptions,
): Promise<Response> {
  let target = assertAllowed(request.url, guard)
  const method = (request.method ?? 'GET').toUpperCase()
  const headers = sanitizeRequestHeaders(request.headers)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), request.timeout ?? 30_000)

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const hasBody = method !== 'GET' && method !== 'HEAD' && request.body !== undefined
      const response = await fetch(target, {
        method,
        headers,
        ...(hasBody ? { body: request.body } : {}),
        redirect: 'manual',
        signal: controller.signal,
      })

      const location = response.headers.get('location')
      if (response.status >= 300 && response.status < 400 && location) {
        target = assertAllowed(new URL(location, target).toString(), guard)
        // Referer ikut berpindah; banyak CDN menolak kalau tertinggal di host lama.
        headers.set('Referer', `${target.origin}/`)
        continue
      }

      return response
    }

    throw new BlockedUrlError(`Lebih dari ${MAX_REDIRECTS} redirect`)
  } finally {
    clearTimeout(timer)
  }
}
