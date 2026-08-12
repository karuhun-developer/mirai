import type { EntryRow, ItemRow } from '@mirai/db'
import { itemDir } from './downloadPath'
import { PLAYLIST_NAME, localizePlaylist } from './hlsPlaylist'
import { fileUrl, listDir, readText, revokeFileUrl } from './storage.service'

/**
 * Membaca kembali apa yang sudah diunduh.
 *
 * Dipisah dari `download.service` yang menulisnya, bukan demi kerapian: antrean
 * unduhan perlu tahu aturan pemutar (kualitas mana yang dipilih), sementara
 * pemutar perlu tahu berkas apa yang ada di perangkat. Satu berkas untuk
 * keduanya berarti `download.service` dan `player.service` saling mengimpor.
 *
 * Semua alamat yang keluar dari sini di web berupa `blob:` yang menahan isi
 * berkasnya di memori sampai dicabut — tiap fungsi pembuka punya pasangan
 * pelepasnya, dan pemanggil wajib memakainya.
 */

// ── Manga ────────────────────────────────────────────────────────────────────

export interface LocalPage {
  index: number
  url: string
}

/**
 * Halaman satu chapter dari berkas di perangkat.
 *
 * Urutannya dari nama berkas, bukan dari daftar halaman source: itulah inti
 * offline — waktu jaringannya mati, `getPageList()` tidak bisa dipanggil sama
 * sekali. Nama `001.jpg` yang berpadding itulah yang membuat urutannya benar.
 */
export async function localPages(entry: EntryRow, item: ItemRow): Promise<LocalPage[]> {
  const dir = itemDir(entry, item)
  const names = await listDir(dir)

  const pages: LocalPage[] = []
  for (const [index, name] of names.entries()) {
    const url = await fileUrl(`${dir}/${name}`)
    if (url) pages.push({ index, url })
  }
  return pages
}

export function releaseLocalPages(pages: readonly LocalPage[]): void {
  for (const page of pages) revokeFileUrl(page.url)
}

// ── Anime ────────────────────────────────────────────────────────────────────

/**
 * Daftar takarir yang ikut terunduh.
 *
 * Perlu berkas katalog sendiri karena labelnya ("Indonesia", "English [Fansub]")
 * tidak muat jadi nama berkas tanpa dirusak, sementara pemilih takarir di
 * pemutar menampilkan label itu apa adanya.
 */
export const SUBTITLES_NAME = 'subtitles.json'

export interface LocalTrackFile {
  /** Nama berkas `.vtt` di direktori episode. */
  name: string
  label: string
  lang?: string
}

/** Episode yang sudah ada di perangkat, siap dipasang ke pemutar. */
export interface LocalVideo {
  type: 'hls' | 'mp4'
  /** `blob:` berisi playlist untuk HLS, atau alamat berkas videonya. */
  url: string
  subtitles: LocalTrack[]
}

export interface LocalTrack {
  url: string
  label: string
  lang?: string
}

/**
 * Episode dari berkas di perangkat; `null` kalau belum lengkap terunduh.
 *
 * Playlist HLS yang tersimpan menyebut segmennya dengan nama berkas relatif, dan
 * yang diserahkan ke pemutar adalah salinannya di memori yang sudah berisi
 * alamat `mirai-local://` absolut. Kenapa tidak disimpan begitu saja di
 * berkasnya: direktori episode ikut berubah kalau judul atau nama episodenya
 * berubah, dan playlist yang menyimpan alamat mutlak akan mati diam-diam.
 *
 * Yang membaca segmennya nanti `createLocalLoader` di `hls.service`; di sinilah
 * satu-satunya tempat skema `mirai-local://` lahir.
 */
export async function localVideo(entry: EntryRow, item: ItemRow): Promise<LocalVideo | null> {
  const dir = itemDir(entry, item)

  const playlist = await readText(`${dir}/${PLAYLIST_NAME}`)
  if (playlist !== null) {
    const blob = new Blob([localizePlaylist(playlist, dir)], {
      type: 'application/vnd.apple.mpegurl',
    })
    return { type: 'hls', url: URL.createObjectURL(blob), subtitles: await localTracks(dir) }
  }

  // Video utuh selalu bernama `video.<ext>` (lihat `videoFileName`), jadi
  // menemukannya tidak perlu mencocokkan apa pun dengan daftar dari source —
  // yang justru tidak bisa dipanggil waktu jaringannya mati.
  const names = await listDir(dir)
  const video = names.find((name) => name.startsWith('video.'))
  if (video === undefined) return null

  const url = await fileUrl(`${dir}/${video}`)
  return url === null ? null : { type: 'mp4', url, subtitles: await localTracks(dir) }
}

/**
 * Bentuk parameternya sengaja minimal, bukan `LocalVideo`: pemutar menyimpan
 * pilihannya sebagai `PlayableVideo`, dan menerima keduanya di sini lebih baik
 * daripada punya dua fungsi pelepas yang lambat laun berbeda isi.
 */
export function releaseLocalVideo(video: {
  url: string
  subtitles: readonly { url: string }[]
}): void {
  revokeFileUrl(video.url)
  for (const track of video.subtitles) revokeFileUrl(track.url)
}

/** Takarir terunduh; episode tanpa katalog berarti memang tidak punya takarir. */
async function localTracks(dir: string): Promise<LocalTrack[]> {
  const catalog = await readText(`${dir}/${SUBTITLES_NAME}`)
  if (catalog === null) return []

  let listed: LocalTrackFile[]
  try {
    listed = JSON.parse(catalog) as LocalTrackFile[]
  } catch {
    // Katalog rusak bukan alasan menolak memutar episodenya.
    return []
  }

  const tracks: LocalTrack[] = []
  for (const file of listed) {
    const url = await fileUrl(`${dir}/${file.name}`)
    if (url === null) continue
    tracks.push({ url, label: file.label, ...(file.lang === undefined ? {} : { lang: file.lang }) })
  }
  return tracks
}
