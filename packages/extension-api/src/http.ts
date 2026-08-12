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
