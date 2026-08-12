import type { HttpHeaders } from './http.js'

/**
 * Bentuk data yang dikembalikan source. Prefiks `S` mengikuti Aniyomi (SManga,
 * SChapter, …) supaya orang yang pernah menulis extension di sana langsung
 * mengenali padanannya.
 *
 * `url` selalu identitas entri di source tersebut — boleh absolut atau relatif
 * terhadap `baseUrl`, tapi harus stabil, karena itu yang disimpan di DB dan
 * dipakai memulihkan entri setelah restart.
 */
export interface SEntry {
  url: string
  title: string
  thumbnailUrl?: string
}

export type SStatus = 'unknown' | 'ongoing' | 'completed' | 'hiatus' | 'cancelled'

export interface SManga extends SEntry {
  author?: string
  artist?: string
  description?: string
  genre?: string[]
  status?: SStatus
}

export interface SAnime extends SEntry {
  studio?: string
  description?: string
  genre?: string[]
  status?: SStatus
  totalEpisodes?: number
}

export interface SChapter {
  url: string
  name: string
  /** Nomor chapter untuk pengurutan. Kosongkan kalau source tidak menyediakannya. */
  chapterNumber?: number
  /** Epoch milidetik. */
  dateUpload?: number
  scanlator?: string
}

export interface SEpisode {
  url: string
  name: string
  episodeNumber?: number
  dateUpload?: number
  /** Episode filler ditandai supaya UI bisa meredupkannya. */
  filler?: boolean
}

export interface SPage {
  index: number
  imageUrl: string
  /** CDN gambar sering menolak permintaan tanpa Referer yang benar. */
  headers?: HttpHeaders
}

export interface STrack {
  url: string
  label: string
  lang?: string
}

/**
 * `'embed'` berarti source menyerah meresolusi dan menyerahkan halaman player
 * pihak ketiga apa adanya. Situs anime memakai belasan host mirror yang tiap
 * beberapa bulan ganti cara menyembunyikan URL-nya; tanpa jalur ini, satu-satunya
 * pilihan adalah membuang mirror yang belum sempat ditulis resolver-nya — dan
 * itu sering berarti episode tanpa video sama sekali.
 */
export type SVideoType = 'hls' | 'mp4' | 'dash' | 'embed'

export interface SVideo {
  url: string
  /** Label kualitas apa adanya dari source, mis. "720p" atau "Mirror 2 · 1080p". */
  quality: string
  type: SVideoType
  headers?: HttpHeaders
  subtitles?: STrack[]
  audios?: STrack[]
}

/** Hasil satu halaman katalog. `hasNextPage` yang menentukan infinite scroll berhenti. */
export interface EntriesPage<T extends SEntry> {
  entries: T[]
  hasNextPage: boolean
}
