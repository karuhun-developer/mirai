import { Capacitor } from '@capacitor/core'
import type { HttpClient } from '@mirai/extension-api'
import { createCapacitorHttpClient } from './capacitor.js'
import { withCloudflareDetection } from './cloudflare.js'
import {
  createProxyHttpClient,
  createProxyMediaResolver,
  directMediaResolver,
  type MediaResolver,
} from './proxy.js'
import { withRateLimit, withUserAgent } from './shared.js'

export interface TransportOptions {
  /** Alamat `apps/proxy`; hanya dipakai di build web. */
  proxyUrl: string
  /** Batas request per detik per host. */
  requestsPerSecond?: number
  /**
   * Menimpa `User-Agent` semua extension. Kosong = biarkan extension memilih.
   * Berupa fungsi karena setelannya bisa berubah selagi app jalan; lihat
   * `withUserAgent()`.
   */
  userAgent?: () => string
}

export interface Transport {
  http: HttpClient
  media: MediaResolver
  /** Berguna di UI Pengaturan dan laporan bug. */
  isNative: boolean
}

/**
 * Memilih transport saat runtime. Ini satu-satunya tempat perbedaan native vs
 * web ada; sisanya bekerja lewat `HttpClient` dan `MediaResolver`.
 */
export function createTransport(options: TransportOptions): Transport {
  const isNative = Capacitor.isNativePlatform()
  const base = isNative ? createCapacitorHttpClient() : createProxyHttpClient(options.proxyUrl)

  // Urutannya berarti. UA dipasang paling dalam supaya nilainya sudah final
  // saat request benar-benar dikirim, deteksi Cloudflare membungkusnya supaya
  // yang diperiksa adalah respons sungguhan, dan rate limit di paling luar
  // supaya jeda dihitung sekali per panggilan extension.
  const http = withCloudflareDetection(withUserAgent(base, options.userAgent ?? (() => '')))

  return {
    http: withRateLimit(http, options.requestsPerSecond ?? 3),
    media: isNative ? directMediaResolver : createProxyMediaResolver(options.proxyUrl),
    isNative,
  }
}

export { createCapacitorHttpClient } from './capacitor.js'
export { isCloudflareChallenge, withCloudflareDetection } from './cloudflare.js'
export { createProxyHttpClient, createProxyMediaResolver, directMediaResolver } from './proxy.js'
export type { MediaResolver } from './proxy.js'
export { lowercaseHeaders, withRateLimit, withUserAgent } from './shared.js'
