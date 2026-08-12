import type { HttpHeaders, SVideoType } from '@mirai/extension-api'

/**
 * Aturan menonton yang tidak menyentuh apa pun di luar dirinya: memilih
 * kualitas, menentukan kapan episode dianggap selesai, dan di detik berapa
 * melanjutkan. Dipisah dari `player.service` supaya bisa diuji tanpa database,
 * tanpa Worker extension, dan tanpa elemen video.
 */

export interface PlayableTrack {
  url: string
  label: string
  lang?: string
}

/** Satu pilihan tonton: satu kualitas dari satu host. */
export interface PlayableVideo {
  /** Siap dipasang ke `<video>`/hls.js — di web sudah lewat proxy. */
  url: string
  quality: string
  type: SVideoType
  /** Header asli dari source; dipakai di native yang bisa memasangnya sendiri. */
  headers?: HttpHeaders
  subtitles: PlayableTrack[]
  /**
   * Berkasnya sudah ada di perangkat. Bukan sekadar penanda tampilan: jalur
   * pemutarnya berbeda (segmen HLS dibaca dari berkas, bukan dari jaringan), dan
   * kegagalannya butuh pesan yang berbeda juga.
   */
  local?: boolean
}

/**
 * Ambang "sudah ditonton": 90% durasi.
 *
 * Bukan "sampai detik terakhir". Episode anime hampir selalu ditutup ending dan
 * pratinjau episode berikutnya — sekitar satu setengah menit dari 24 menit —
 * dan orang berhenti di situ. Menuntut detik terakhir membuat episode yang
 * jelas sudah ditonton tetap bertanda belum, dan itu merusak daftar Updates
 * serta tombol Lanjut sekaligus.
 */
export const FINISHED_RATIO = 0.9

export function isFinished(position: number, duration: number): boolean {
  if (!Number.isFinite(duration) || duration <= 0) return false
  return position >= duration * FINISHED_RATIO
}

/**
 * Detik untuk melanjutkan.
 *
 * Episode yang sudah selesai mulai dari nol: membukanya lagi hampir selalu
 * berarti ingin menontonnya ulang, bukan melihat sepuluh detik terakhirnya.
 * Posisi yang sudah melewati ambang selesai diperlakukan sama walau belum
 * sempat tertandai — misalnya app tertutup tepat sebelum tandanya tertulis.
 */
export function resumeAt(item: { seen: number; last_position: number }, duration = 0): number {
  if (item.seen === 1) return 0
  const saved = Math.max(item.last_position, 0)
  if (duration > 0 && isFinished(saved, duration)) return 0
  return saved
}

/**
 * Angka tinggi gambar dari label kualitas apa adanya: `"720p"`, `"HD 1080P"`,
 * `"Mirror 2 · 480p"`. Yang tidak menyebut angka mengembalikan `undefined` —
 * label semacam "Default" atau nama host tidak boleh ikut diurutkan sebagai 0.
 */
export function heightOf(quality: string): number | undefined {
  const match = /(\d{3,4})\s*p/i.exec(quality) ?? /\b(\d{3,4})\b/.exec(quality)
  const value = match?.[1]
  return value ? Number.parseInt(value, 10) : undefined
}

/**
 * Memilih video yang diputar.
 *
 * Urutan pertimbangannya: yang benar-benar bisa diputar lebih dulu (tipe
 * `embed` cuma halaman player pihak ketiga, bukan berkas video), lalu label
 * yang sama persis dengan pilihan terakhir pengguna, lalu tinggi gambar
 * terdekat **di bawah** pilihan itu — turun ke 480p lebih baik daripada naik ke
 * 1080p buat orang yang sengaja memilih 720p demi kuota.
 *
 * Mengembalikan indeks, bukan videonya, supaya pemanggil tahu pilihan mana yang
 * sedang aktif di daftar aslinya.
 */
export function pickVideo(videos: PlayableVideo[], preferred: string): number {
  if (videos.length === 0) return -1

  const playable = videos
    .map((video, index) => ({ video, index }))
    .filter((row) => row.video.type !== 'embed')
  const pool = playable.length > 0 ? playable : videos.map((video, index) => ({ video, index }))

  const exact = pool.find((row) => row.video.quality.toLowerCase() === preferred.toLowerCase())
  if (exact) return exact.index

  const target = heightOf(preferred)
  if (target === undefined) return pool[0]?.index ?? -1

  const scored = pool
    .map((row) => ({ ...row, height: heightOf(row.video.quality) }))
    .filter((row): row is typeof row & { height: number } => row.height !== undefined)
  if (scored.length === 0) return pool[0]?.index ?? -1

  const below = scored.filter((row) => row.height <= target).sort((a, b) => b.height - a.height)
  if (below[0]) return below[0].index

  const above = [...scored].sort((a, b) => a.height - b.height)
  return above[0]?.index ?? pool[0]?.index ?? -1
}

/** `754` → `12:34`, `3723` → `1:02:03`. Jam disembunyikan kalau nol. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'

  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = whole % 60

  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  return `${hours > 0 ? `${hours}:` : ''}${mm}:${String(rest).padStart(2, '0')}`
}
