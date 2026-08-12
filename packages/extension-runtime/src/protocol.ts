import type { HttpRequest, HttpResponse, SourcePreference } from '@mirai/extension-api'

/**
 * Protokol RPC antara host dan worker extension.
 *
 * Dua arah, dua-duanya request/response berpasangan lewat `id`:
 * host memanggil metode source, worker meminta host melakukan HTTP. Tidak ada
 * jalur lain — itu yang membuat kode pihak ketiga tetap terkurung.
 */

export interface SerializedError {
  message: string
  stack?: string
  /** Diisi kalau errornya `HttpError`, supaya UI bisa membedakan 404 dari bug parser. */
  status?: number
  /**
   * Diisi kalau errornya `CloudflareChallengeError`: halaman yang harus dibuka
   * pengguna untuk menyelesaikan verifikasi. Ikut melintas RPC karena tanpa itu
   * UI cuma punya teks pesan, dan mencocokkan teks untuk memutuskan menampilkan
   * tombol adalah cara paling gampang bikin fitur ini diam-diam mati.
   */
  challengeUrl?: string
}

/** Ringkasan source yang aman dikirim lintas worker (tanpa fungsi). */
export interface SourceInfo {
  id: string
  name: string
  lang: string
  baseUrl: string
  supportsLatest: boolean
  isNsfw: boolean
  kind: 'manga' | 'anime'
  preferences: SourcePreference[]
}

export type SourceMethod =
  | 'getPopular'
  | 'getLatest'
  | 'getSearch'
  | 'getDetails'
  | 'getFilterList'
  | 'getChapterList'
  | 'getPageList'
  | 'getEpisodeList'
  | 'getVideoList'

export type PreferenceSnapshot = Record<string, string | boolean | string[]>

export type HostMessage =
  /** Menjalankan kode extension dan mengumpulkan source yang diekspornya. */
  | { kind: 'init'; id: number; code: string; apiVersion: number; prefs: PreferenceSnapshot }
  | { kind: 'call'; id: number; sourceId: string; method: SourceMethod; args: unknown[] }
  /** Jawaban atas permintaan HTTP dari worker. */
  | { kind: 'http:ok'; id: number; res: HttpResponse }
  | { kind: 'http:fail'; id: number; error: SerializedError }

export type WorkerMessage =
  | { kind: 'ready'; id: number; sources: SourceInfo[] }
  | { kind: 'ok'; id: number; value: unknown }
  | { kind: 'fail'; id: number; error: SerializedError }
  | { kind: 'http'; id: number; req: HttpRequest }

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    // Dibaca lewat properti, bukan `instanceof`: error ini sudah pernah melintas
    // batas worker sekali dan kehilangan prototipenya di jalan.
    const { status, challengeUrl } = error as { status?: unknown; challengeUrl?: unknown }
    const base: SerializedError = { message: error.message }
    if (error.stack !== undefined) base.stack = error.stack
    if (typeof status === 'number') base.status = status
    if (typeof challengeUrl === 'string') base.challengeUrl = challengeUrl
    return base
  }
  return { message: String(error) }
}

/** Error yang dilempar host saat memanggil source; membawa asal-usulnya. */
export class SourceCallError extends Error {
  constructor(
    readonly sourceId: string,
    readonly method: string,
    error: SerializedError,
  ) {
    super(`${sourceId}.${method}(): ${error.message}`)
    this.name = 'SourceCallError'
    this.status = error.status
    this.remoteStack = error.stack
    this.challengeUrl = error.challengeUrl
  }

  readonly status: number | undefined
  readonly remoteStack: string | undefined
  /** Terisi kalau kegagalannya tantangan Cloudflare, bukan error biasa. */
  readonly challengeUrl: string | undefined
}
