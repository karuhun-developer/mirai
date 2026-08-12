import { Capacitor } from '@capacitor/core'
import type { HttpClient } from '@mirai/extension-api'
import { createCapacitorHttpClient } from './capacitor.js'
import {
  createProxyHttpClient,
  createProxyMediaResolver,
  directMediaResolver,
  type MediaResolver,
} from './proxy.js'
import { withRateLimit } from './shared.js'

export interface TransportOptions {
  /** Alamat `apps/proxy`; hanya dipakai di build web. */
  proxyUrl: string
  /** Batas request per detik per host. */
  requestsPerSecond?: number
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
  const http = isNative ? createCapacitorHttpClient() : createProxyHttpClient(options.proxyUrl)

  return {
    http: withRateLimit(http, options.requestsPerSecond ?? 3),
    media: isNative ? directMediaResolver : createProxyMediaResolver(options.proxyUrl),
    isNative,
  }
}

export { createCapacitorHttpClient } from './capacitor.js'
export { createProxyHttpClient, createProxyMediaResolver, directMediaResolver } from './proxy.js'
export type { MediaResolver } from './proxy.js'
export { lowercaseHeaders, withRateLimit } from './shared.js'
