import type {
  AnySource,
  HttpClient,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
  PreferenceStore,
  SourceContext,
  SourceFactory,
} from '@mirai/extension-api'
import type {
  HostMessage,
  PreferenceSnapshot,
  SourceInfo,
  SourceMethod,
  WorkerMessage,
} from './protocol.js'
import { serializeError } from './protocol.js'

/**
 * Sandbox tempat kode extension dijalankan.
 *
 * Di sini tidak ada DOM, tidak ada akses penyimpanan aplikasi, dan `fetch`
 * global sengaja dimatikan: satu-satunya jalan keluar adalah `ctx.http`, yang
 * dilewatkan balik ke host lewat RPC. Host yang memutuskan transport, memasang
 * rate limit, dan mencatat request.
 */

// lib.dom dan lib.webworker tidak bisa dipakai bersamaan tanpa bentrok tipe,
// jadi permukaan worker yang dipakai dideklarasikan seperlunya di sini saja.
declare const self: {
  postMessage(message: WorkerMessage): void
  onmessage: ((event: { data: HostMessage }) => void) | null
}

const sources = new Map<string, AnySource>()
const pendingHttp = new Map<
  number,
  { resolve: (res: HttpResponse) => void; reject: (error: Error) => void }
>()
let nextHttpId = 1

function requestHttp(req: HttpRequest): Promise<HttpResponse> {
  const id = nextHttpId++
  return new Promise<HttpResponse>((resolve, reject) => {
    pendingHttp.set(id, { resolve, reject })
    self.postMessage({ kind: 'http', id, req })
  })
}

const http: HttpClient = {
  request: (req) => requestHttp(req),
  get: (url, headers) => requestHttp(headers ? { url, method: 'GET', headers } : { url }),
  post: (url, body, headers) =>
    requestHttp(headers ? { url, method: 'POST', body, headers } : { url, method: 'POST', body }),
  async getJson(url: string, headers?: HttpHeaders): Promise<unknown> {
    const res = await requestHttp(headers ? { url, headers } : { url })
    return JSON.parse(res.body) as unknown
  },
}

function createPreferenceStore(snapshot: PreferenceSnapshot): PreferenceStore {
  return {
    getString: (key, fallback) => {
      const value = snapshot[key]
      return typeof value === 'string' ? value : fallback
    },
    getBoolean: (key, fallback) => {
      const value = snapshot[key]
      return typeof value === 'boolean' ? value : fallback
    },
    getStringList: (key, fallback) => {
      const value = snapshot[key]
      return Array.isArray(value) ? [...value] : [...fallback]
    },
  }
}

function describe(source: AnySource): SourceInfo {
  const configurable = source as { getPreferences?: () => SourceInfo['preferences'] }
  return {
    id: source.id,
    name: source.name,
    lang: source.lang,
    baseUrl: source.baseUrl,
    supportsLatest: source.supportsLatest,
    isNsfw: source.isNsfw,
    kind: source.kind,
    preferences: configurable.getPreferences?.() ?? [],
  }
}

async function init(message: Extract<HostMessage, { kind: 'init' }>): Promise<SourceInfo[]> {
  // Kode extension diimpor lewat blob, bukan langsung dari URL repo: host sudah
  // mengunduhnya dengan transport yang benar (native atau proxy), jadi worker
  // tidak perlu jalan keluar sendiri dan CORS repo tidak ikut jadi masalah.
  const blob = new Blob([message.code], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)

  try {
    const module = (await import(/* @vite-ignore */ url)) as { default?: unknown }
    const factory = module.default
    if (typeof factory !== 'function') {
      throw new Error('Extension harus `export default` sebuah SourceFactory')
    }

    const ctx: SourceContext = {
      apiVersion: message.apiVersion,
      http,
      preferences: createPreferenceStore(message.prefs),
    }

    const produced = (factory as SourceFactory)(ctx)
    if (!Array.isArray(produced) || produced.length === 0) {
      throw new Error('SourceFactory tidak mengembalikan satu source pun')
    }

    sources.clear()
    for (const source of produced) sources.set(source.id, source)
    return produced.map(describe)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function call(message: Extract<HostMessage, { kind: 'call' }>): Promise<unknown> {
  const source = sources.get(message.sourceId)
  if (!source) throw new Error(`Source ${message.sourceId} tidak ada di extension ini`)

  const method = (source as unknown as Record<SourceMethod, unknown>)[message.method]
  if (typeof method !== 'function') {
    throw new Error(`${source.name} tidak menyediakan ${message.method}()`)
  }

  return (method as (...args: unknown[]) => unknown).apply(source, message.args)
}

self.onmessage = (event) => {
  const message = event.data

  if (message.kind === 'http:ok' || message.kind === 'http:fail') {
    const pending = pendingHttp.get(message.id)
    if (!pending) return
    pendingHttp.delete(message.id)
    if (message.kind === 'http:ok') pending.resolve(message.res)
    else pending.reject(Object.assign(new Error(message.error.message), message.error))
    return
  }

  if (message.kind === 'init') {
    init(message)
      .then((infos) => self.postMessage({ kind: 'ready', id: message.id, sources: infos }))
      .catch((error: unknown) =>
        self.postMessage({ kind: 'fail', id: message.id, error: serializeError(error) }),
      )
    return
  }

  call(message)
    .then((value) => self.postMessage({ kind: 'ok', id: message.id, value }))
    .catch((error: unknown) =>
      self.postMessage({ kind: 'fail', id: message.id, error: serializeError(error) }),
    )
}

// Ditutup setelah `http` dibentuk supaya extension yang nekat memanggil fetch
// mendapat pesan yang mengarahkan, bukan error jaringan yang membingungkan.
Reflect.set(globalThis, 'fetch', () => {
  throw new Error('Extension tidak boleh memanggil fetch(); pakai ctx.http')
})
Reflect.set(globalThis, 'XMLHttpRequest', undefined)
Reflect.set(globalThis, 'importScripts', undefined)
