/**
 * Kontrak HTTP. Extension tidak pernah memanggil `fetch` global — semua request
 * lewat `HttpClient` yang disuntikkan host, supaya rate limit, cookie, dan
 * pemilihan transport (native vs proxy) tetap jadi urusan host.
 */

export type HttpHeaders = Readonly<Record<string, string>>

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

export interface HttpRequest {
  readonly url: string
  readonly method?: HttpMethod
  readonly headers?: HttpHeaders
  readonly body?: string
  /** Batas waktu dalam milidetik. Host boleh memperketat, tidak boleh melonggarkan. */
  readonly timeout?: number
}

export interface HttpResponse {
  /** URL final setelah redirect — dipakai untuk meresolusi tautan relatif. */
  readonly url: string
  readonly status: number
  readonly ok: boolean
  /** Nama header sudah dinormalkan ke huruf kecil oleh host. */
  readonly headers: HttpHeaders
  readonly body: string
}

export interface HttpClient {
  request(req: HttpRequest): Promise<HttpResponse>
  get(url: string, headers?: HttpHeaders): Promise<HttpResponse>
  post(url: string, body: string, headers?: HttpHeaders): Promise<HttpResponse>
  /**
   * Sengaja `unknown`, bukan generic. Bentuk respons API pihak ketiga tidak
   * bisa dijamin saat kompilasi; penulis extension wajib mempersempitnya
   * sendiri supaya kegagalan muncul di batas, bukan jauh di dalam parser.
   */
  getJson(url: string, headers?: HttpHeaders): Promise<unknown>
}

/** Dilempar `HttpClient` saat respons bukan 2xx, agar bisa dibedakan dari bug parser. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} dari ${url}`)
    this.name = 'HttpError'
  }
}

/**
 * Situsnya hidup, tapi Cloudflare menahan request dengan tantangan "verify you
 * are human". Dipisah dari `HttpError` biasa karena penanganannya berbeda
 * secara mendasar: 403 biasa berarti kode extension salah alamat, sedangkan ini
 * berarti **manusianya** yang harus turun tangan. Mirai mengikuti sikap
 * Aniyomi — tantangan tidak diputari otomatis, penggunanya yang menyelesaikan
 * di WebView. Kalau tidak bisa, sumber itu memang tidak bisa dipakai.
 *
 * `challengeUrl` adalah halaman yang harus dibuka pengguna, bukan URL API yang
 * kebetulan kena — biar tombol "Selesaikan verifikasi" mendarat di tempat yang
 * benar-benar menampilkan tantangannya.
 */
export class CloudflareChallengeError extends HttpError {
  readonly challengeUrl: string

  constructor(status: number, url: string, challengeUrl?: string) {
    super(status, url, `Cloudflare meminta verifikasi sebelum ${url} bisa dibuka`)
    this.name = 'CloudflareChallengeError'
    this.challengeUrl = challengeUrl ?? url
  }
}
