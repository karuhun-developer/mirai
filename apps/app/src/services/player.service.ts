import type { RemoteAnimeSource } from '@mirai/extension-runtime'
import type { ItemRow } from '@mirai/db'
import { toSItem } from '@mirai/db'
import { repos } from './db.service'
import { transport } from './extensions.service'
import type { PlayableTrack, PlayableVideo } from './playback'
import { toVtt } from './subtitle'

/**
 * Player anime: daftar video satu episode, takarirnya, dan progres tontonannya.
 *
 * Batas yang berlaku sampai unduhan hadir di Fase 7: **video selalu datang dari
 * jaringan.** Yang offline-first di sini cuma posisi tonton dan statusnya.
 */

// ── Setelan ──────────────────────────────────────────────────────────────────

export interface PlayerPrefs {
  /** Label kualitas terakhir yang dipilih; kosong berarti ikut urutan sumber. */
  quality: string
  /** Lanjut ke episode berikutnya sendiri begitu yang ini habis. */
  autoplayNext: boolean
  /** Berapa detik dilompati tombol "Lewati intro". */
  skipSeconds: number
  /** Nyalakan takarir kalau episodenya punya. */
  subtitles: boolean
  speed: number
  volume: number
  fullscreen: boolean
  /** Kunci orientasi layar; hanya berlaku di APK. */
  orientation: 'free' | 'portrait' | 'landscape'
}

export const defaultPlayerPrefs: PlayerPrefs = {
  quality: '',
  autoplayNext: true,
  // 85 detik: panjang opening anime yang nyaris jadi standar industri.
  skipSeconds: 85,
  subtitles: true,
  speed: 1,
  volume: 1,
  fullscreen: false,
  orientation: 'free',
}

const PREFS_KEY = 'player.prefs'

export async function readPlayerPrefs(): Promise<PlayerPrefs> {
  const stored = await repos().settings.getJson<Partial<PlayerPrefs>>(PREFS_KEY, {})
  return { ...defaultPlayerPrefs, ...stored }
}

export async function writePlayerPrefs(prefs: PlayerPrefs): Promise<void> {
  await repos().settings.setJson(PREFS_KEY, prefs)
}

// ── Memuat ───────────────────────────────────────────────────────────────────

/**
 * Daftar video dari source.
 *
 * URL-nya dibiarkan **asli** — tidak dilewatkan resolver media di sini.
 * Alasannya beda per tipe: mp4 butuh alamat proxy di `<video src>`, sedangkan
 * HLS harus tetap asli supaya URL relatif di dalam playlist tidak diselesaikan
 * terhadap alamat proxy (lihat `hlsLoader.ts`), dan takarir malah lebih baik
 * diambil lewat `HttpClient` biasa karena isinya perlu dikonversi dulu.
 * Menyeragamkannya di sini justru merusak dua dari tiga jalur itu.
 */
export async function loadVideos(
  source: RemoteAnimeSource,
  item: ItemRow,
): Promise<PlayableVideo[]> {
  if (fixtureVideos) return fixtureVideos

  const videos = await source.getVideoList(toSItem(item))

  return videos
    .filter((video) => typeof video.url === 'string' && video.url !== '')
    .map((video) => {
      const subtitles: PlayableTrack[] = (video.subtitles ?? []).map((track) => ({
        url: track.url,
        label: track.label,
        ...(track.lang === undefined ? {} : { lang: track.lang }),
      }))

      return {
        url: video.url,
        quality: video.quality,
        type: video.type,
        ...(video.headers === undefined ? {} : { headers: video.headers }),
        subtitles,
      }
    })
}

/**
 * Mengambil takarir dan mengubahnya jadi WebVTT di dalam blob URL.
 *
 * Diambil lewat `HttpClient`, bukan `fetch` langsung: berkas takarir tinggal di
 * host yang sama rewelnya dengan videonya. Hasilnya blob supaya `<track>`
 * membacanya dari origin yang sama — `<track>` lintas-origin diam-diam tidak
 * pernah tampil walau berkasnya berhasil diunduh.
 */
export async function loadSubtitle(track: PlayableTrack): Promise<string> {
  const response = await transport.http.get(track.url)
  if (!response.ok) throw new Error(`Takarir gagal diambil (${response.status})`)

  const blob = new Blob([toVtt(response.body)], { type: 'text/vtt' })
  return URL.createObjectURL(blob)
}

// ── Progres ──────────────────────────────────────────────────────────────────

/**
 * Menyimpan posisi tonton dalam detik. Dipanggil berkala selama memutar, jadi
 * app yang ditutup mendadak — atau ditutup sistem karena kehabisan memori —
 * tetap meninggalkan jejak yang bisa dilanjutkan.
 */
export async function saveProgress(
  item: ItemRow,
  seconds: number,
  duration: number,
): Promise<void> {
  const position = Math.floor(Math.max(seconds, 0))
  const total = Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : undefined

  await repos().items.setProgress(item.id, position, total)
  await repos().history.record(item.id, item.entry_id, position)
}

/**
 * Menandai episode selesai. Ambangnya di `playback.isFinished` — di sini cuma
 * dituliskan. Posisi ikut disimpan apa adanya, bukan dipaksa ke durasi penuh:
 * kalau orangnya berhenti di menit 22 dari 24, di situlah ia berhenti.
 */
export async function markWatched(item: ItemRow, seconds: number, duration: number): Promise<void> {
  const { items, history } = repos()
  const position = Math.floor(Math.max(seconds, 0))

  await items.markSeen([item.id], true)
  await items.setProgress(item.id, position, Math.floor(duration) || undefined)
  await history.record(item.id, item.entry_id, position)
}

// ── Jalur uji ────────────────────────────────────────────────────────────────

/**
 * Daftar video tiruan untuk `scripts/smoke.mjs`.
 *
 * Situs anime tidak terjangkau dari mesin pengembangan ini, dan Chromium yang
 * dipakai Playwright tidak punya dekoder H.264 — dua hal yang membuat seluruh
 * jalur "buka episode → putar → posisi tersimpan" mustahil diverifikasi dengan
 * sumber sungguhan. Dengan satu berkas video kecil yang bisa didekode, sisa
 * rantainya (konteks episode, pemilihan kualitas, progres, lanjut, tanda
 * selesai) diuji apa adanya di browser sungguhan.
 *
 * Cuma dipasang saat dev, dan diam sampai benar-benar dipanggil: build produksi
 * tidak membawa jalur ini sama sekali.
 */
let fixtureVideos: PlayableVideo[] | null = null

if (import.meta.env.DEV) {
  const bridge = {
    fixture(videos: PlayableVideo[] | null): void {
      fixtureVideos = videos
    },
  }
  ;(globalThis as unknown as { __player?: typeof bridge }).__player = bridge
}
