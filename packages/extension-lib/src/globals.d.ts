/**
 * `URL` dan `URLSearchParams` ada di setiap lingkungan tempat extension jalan
 * (Worker, Node, browser), tapi bukan bagian dari lib ES2022 — dan menarik lib
 * DOM cuma untuk dua kelas ini akan ikut membawa `document`, `window`, serta
 * seluruh permukaan yang justru sengaja tidak boleh disentuh extension.
 *
 * Jadi dideklarasikan seperlunya di sini saja.
 */

declare class URLSearchParams {
  constructor(init?: string | Record<string, string> | [string, string][])
  append(name: string, value: string): void
  set(name: string, value: string): void
  get(name: string): string | null
  toString(): string
}

/** Ada di Worker maupun Node; dipakai `decodeBase64`/`encodeBase64`. */
declare function atob(data: string): string
declare function btoa(data: string): string

declare class TextDecoder {
  constructor(label?: string)
  decode(input?: ArrayBufferView): string
}

declare class URL {
  constructor(url: string, base?: string)
  readonly origin: string
  readonly host: string
  readonly hostname: string
  readonly protocol: string
  pathname: string
  search: string
  readonly searchParams: URLSearchParams
  toString(): string
}
