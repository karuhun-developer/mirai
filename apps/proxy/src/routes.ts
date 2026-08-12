import { Readable } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import type { ProxyConfig } from './config.ts'
import { fetchGuarded, sanitizeResponseHeaders, type UpstreamRequest } from './fetcher.ts'
import { BlockedUrlError } from './guard.ts'

/** Body datang dari jaringan, jadi setiap field diperlakukan sebagai opsional. */
type FetchBody = Partial<UpstreamRequest>

interface StreamQuery {
  url?: string
  headers?: string
}

function parseHeaderParam(raw: string | undefined): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

/**
 * `fetch()` Node membungkus semua kegagalan jaringan jadi satu pesan "fetch
 * failed" yang tidak memberi tahu apa pun. Penyebab aslinya (`ENOTFOUND`,
 * `ECONNREFUSED`, timeout TLS) ada di rantai `cause` — itu yang perlu sampai ke
 * layar user, karena selisih antara "situsnya mati" dan "DNS kamu diblokir"
 * menentukan langkah berikutnya.
 */
function describeFailure(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error

  for (let depth = 0; current instanceof Error && depth < 4; depth += 1) {
    const code = (current as NodeJS.ErrnoException).code
    parts.push(code ? `${current.message} (${code})` : current.message)
    current = current.cause
  }

  return parts.join(' — ') || String(error)
}

export function registerRoutes(app: FastifyInstance, config: ProxyConfig): void {
  const guard = { allowedHosts: config.allowedHosts }

  app.get('/health', () => ({
    ok: true,
    allowedHosts: config.allowedHosts.length,
  }))

  /**
   * Jalur untuk extension: mengambil dokumen/JSON dan mengembalikannya sebagai
   * teks. Body dibaca penuh di sini karena parser extension memang butuh
   * seluruh dokumen — itu sebabnya ada batas ukuran.
   */
  app.post<{ Body: FetchBody }>('/fetch', async (request, reply) => {
    const body = request.body
    if (!body?.url) return reply.code(400).send({ error: 'url wajib diisi' })

    try {
      const response = await fetchGuarded({ ...body, url: body.url }, guard)
      const length = Number(response.headers.get('content-length') ?? 0)
      if (length > config.maxBodyBytes) {
        return reply.code(413).send({ error: 'Respons melebihi batas ukuran proxy' })
      }

      const text = await response.text()
      if (text.length > config.maxBodyBytes) {
        return reply.code(413).send({ error: 'Respons melebihi batas ukuran proxy' })
      }

      return reply.send({
        url: response.url || body.url,
        status: response.status,
        ok: response.ok,
        headers: sanitizeResponseHeaders(response.headers),
        body: text,
      })
    } catch (error) {
      if (error instanceof BlockedUrlError) return reply.code(403).send({ error: error.message })
      request.log.error({ err: error }, 'fetch gagal')
      return reply.code(502).send({ error: describeFailure(error) })
    }
  })

  /**
   * Jalur untuk gambar dan video: `Range` diteruskan apa adanya dan body
   * di-stream, tidak pernah di-buffer. Menahan video di memori proxy akan
   * mematikannya pada file pertama yang lebih besar dari RAM.
   */
  app.get<{ Querystring: StreamQuery }>('/stream', async (request, reply) => {
    const { url, headers } = request.query
    if (!url) return reply.code(400).send({ error: 'url wajib diisi' })

    const forwarded = parseHeaderParam(headers)
    const range = request.headers.range
    if (range) forwarded['Range'] = range

    try {
      const response = await fetchGuarded({ url, headers: forwarded }, guard)

      reply.code(response.status)
      for (const [key, value] of Object.entries(sanitizeResponseHeaders(response.headers))) {
        reply.header(key, value)
      }
      // Tanpa ini pemutar tidak tahu boleh melakukan seek, dan seluruh video
      // harus diunduh dari awal setiap kali user menggeser posisi.
      reply.header('accept-ranges', response.headers.get('accept-ranges') ?? 'bytes')

      const contentLength = response.headers.get('content-length')
      if (contentLength) reply.header('content-length', contentLength)

      if (!response.body) return reply.send()
      return reply.send(Readable.fromWeb(response.body))
    } catch (error) {
      if (error instanceof BlockedUrlError) return reply.code(403).send({ error: error.message })
      request.log.error({ err: error }, 'stream gagal')
      return reply.code(502).send({ error: describeFailure(error) })
    }
  })
}
