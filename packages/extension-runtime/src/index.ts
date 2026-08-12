/**
 * @mirai/extension-runtime — satu-satunya paket yang tahu cara menjalankan kode
 * asing: memuat bundel extension ke Worker, memperantarai HTTP-nya, dan
 * memberikan pembungkus yang enak dipakai halaman.
 */

export { ExtensionInstance, RemoteAnimeSource, RemoteMangaSource, bindSources } from './host.js'
export type { LoadOptions, RemoteSource } from './host.js'

export { SourceCallError, serializeError } from './protocol.js'
export type {
  HostMessage,
  PreferenceSnapshot,
  SerializedError,
  SourceInfo,
  SourceMethod,
  WorkerMessage,
} from './protocol.js'

export {
  createCapacitorHttpClient,
  createProxyHttpClient,
  createProxyMediaResolver,
  createTransport,
  directMediaResolver,
  isCloudflareChallenge,
  lowercaseHeaders,
  withCloudflareDetection,
  withRateLimit,
  withUserAgent,
} from './http/index.js'
export type { MediaResolver, Transport, TransportOptions } from './http/index.js'
