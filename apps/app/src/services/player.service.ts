import type { RemoteAnimeSource } from '@mirai/extension-runtime'
import type { ItemRow } from '@mirai/db'
import { toSItem } from '@mirai/db'
import type { EntryRow } from '@mirai/db'
import { t } from '@/i18n'
import { repos } from './db.service'
import { isLocalUrl, transport } from './extensions.service'
import { localVideo, releaseLocalVideo } from './localMedia'
import type { PlayableTrack, PlayableVideo } from './playback'
import { toVtt } from './subtitle'

/**
 * Player anime: daftar video satu episode, takarirnya, dan progres tontonannya.
 *
 * Episode yang sudah diunduh diputar dari berkas di perangkat, dan yang belum
 * tetap butuh jaringan — `resolveVideos()` satu-satunya yang memutuskan itu.
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

export interface PlayerVideos {
  videos: PlayableVideo[]
  /** Berkasnya dari perangkat; pemanggil wajib melepasnya lewat `releaseVideos()`. */
  local: boolean
}

/**
 * Pilihan tonton satu episode: dari perangkat kalau sudah diunduh, dari source
 * kalau belum.
 *
 * Lokal selalu didahulukan, bahkan waktu jaringannya sehat — itulah gunanya
 * mengunduh. Episode yang bertanda terunduh tapi berkasnya tidak ditemukan
 * (browser membuang OPFS waktu ruang menipis, atau berkasnya dihapus dari luar)
 * tandanya diturunkan di tempat lalu diambil ulang seperti biasa, sama persis
 * dengan aturan chapter di `loadPages()`.
 *
 * Yang lokal cuma menawarkan satu pilihan: kualitasnya sudah ditentukan waktu
 * mengunduh, dan pemilih kualitas berisi satu baris lebih jujur daripada daftar
 * yang separuh isinya tidak ada di perangkat.
 */
export async function resolveVideos(
  entry: EntryRow,
  item: ItemRow,
  source: RemoteAnimeSource | undefined,
): Promise<PlayerVideos> {
  if (item.downloaded === 1) {
    const local = await localVideo(entry, item)
    if (local) {
      return {
        videos: [
          {
            url: local.url,
            quality: t('player.downloadedQuality'),
            type: local.type,
            subtitles: local.subtitles.map((track) => ({
              url: track.url,
              label: track.label,
              ...(track.lang === undefined ? {} : { lang: track.lang }),
            })),
            local: true,
          },
        ],
        local: true,
      }
    }
    await repos().items.setDownloaded([item.id], false)
  }

  if (!source) {
    throw new Error(t('errors.playerSourceMissing'))
  }

  return { videos: await loadVideos(source, item), local: false }
}

/**
 * Melepas alamat berkas episode lokal beserta takarirnya. Object URL menahan
 * seluruh isi berkasnya di memori sampai dicabut — untuk video 300 MB itu bukan
 * kebocoran kecil.
 */
export function releaseVideos(videos: readonly PlayableVideo[]): void {
  for (const video of videos) {
    if (video.local) releaseLocalVideo(video)
  }
}

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
 *
 * Takarir terunduh sudah berupa VTT di perangkat, jadi lewat `fetch` biasa;
 * `toVtt()` tetap dijalankan karena berkas yang sudah WebVTT dibiarkannya apa
 * adanya, dan satu jalur lebih sedikit berarti satu jalur lebih sedikit yang
 * bisa berbeda perilaku.
 */
export async function loadSubtitle(track: PlayableTrack): Promise<string> {
  const body = isLocalUrl(track.url)
    ? await fetchLocalText(track.url)
    : await fetchRemoteText(track.url)

  const blob = new Blob([toVtt(body)], { type: 'text/vtt' })
  return URL.createObjectURL(blob)
}

async function fetchLocalText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(t('errors.subtitleRead', { status: response.status }))
  return response.text()
}

async function fetchRemoteText(url: string): Promise<string> {
  const response = await transport.http.get(url)
  if (!response.ok) throw new Error(t('errors.subtitleFetch', { status: response.status }))
  return response.body
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
