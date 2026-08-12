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
 * Menimpa `User-Agent` semua request dengan satu nilai.
 *
 * Ini **menimpa**, bukan mengisi kalau kosong — `extension-lib` selalu memasang
 * UA-nya sendiri, jadi nilai yang cuma jadi cadangan tidak akan pernah terpakai
 * dan setelannya jadi tombol mati. Alasannya juga bukan selera: cookie
 * `cf_clearance` hasil verifikasi Cloudflare terikat ke UA yang menyelesaikan
 * tantangan, jadi request sesudahnya wajib memakai UA yang persis sama.
 *
 * Karena itu nilai kosong berarti "jangan sentuh": selama pengguna tidak
 * mengaturnya, extension tetap memegang kendali penuh atas UA-nya.
 *
 * Nilainya dibaca per request, bukan sekali saat transport dibuat: mengganti UA
 * adalah langkah diagnosis, dan memaksa restart app untuk mencobanya membuat
 * setelan itu hampir tidak berguna.
 */
export function withUserAgent(client: HttpClient, resolve: () => string): HttpClient {
  function override(headers?: HttpHeaders): HttpHeaders | undefined {
    const userAgent = resolve().trim()
    if (userAgent === '') return headers

    // Nama header tidak case-sensitive; kunci lama harus dibuang, kalau tidak
    // dua `user-agent` terkirim sekaligus dan servernya yang memilih.
    const merged: Record<string, string> = {}
    for (const [key, value] of Object.entries(headers ?? {})) {
      if (key.toLowerCase() !== 'user-agent') merged[key] = value
    }
    merged['User-Agent'] = userAgent
    return merged
  }

  return {
    ...client,
    request: (req) => {
      const headers = override(req.headers)
      return client.request(headers ? { ...req, headers } : req)
    },
    get: (url, headers) => client.get(url, override(headers)),
    post: (url, body, headers) => client.post(url, body, override(headers)),
    getJson: (url, headers) => client.getJson(url, override(headers)),
  }
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
