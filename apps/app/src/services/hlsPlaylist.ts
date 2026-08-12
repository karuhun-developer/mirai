/**
 * Aturan playlist HLS: membacanya, memilih varian, dan menulisnya ulang supaya
 * menunjuk berkas di perangkat.
 *
 * Semuanya murni — tidak menyentuh jaringan, penyimpanan, maupun hls.js — karena
 * di sinilah letak kesalahan yang paling mahal: satu URI yang salah diselesaikan
 * berarti episode berukuran ratusan megabita yang ternyata tidak bisa diputar.
 * Dipisah begitu, aturannya bisa diuji utuh tanpa mengunduh apa pun.
 *
 * Bentuk playlist yang ditangani cuma yang benar-benar dipakai situs anime:
 * master dengan `#EXT-X-STREAM-INF`, media playlist dengan segmen, `#EXT-X-KEY`
 * (AES-128), dan `#EXT-X-MAP` (segmen inisialisasi fMP4).
 */

/** Nama playlist hasil unduhan; keberadaannya menandai episode HLS yang lengkap. */
export const PLAYLIST_NAME = 'index.m3u8'

/**
 * Skema alamat berkas lokal di dalam playlist yang diputar.
 *
 * Sengaja skema karangan sendiri, bukan `blob:` atau `capacitor:` langsung:
 * alamat berkas baru dibuat waktu segmennya benar-benar diminta (lihat
 * `createLocalLoader`), jadi satu episode berisi ratusan segmen tidak perlu
 * membuka ratusan berkas sekaligus di awal. Bentuk `skema://path` dipilih supaya
 * hls.js mengenalinya sebagai alamat absolut dan tidak mencoba menyelesaikannya
 * terhadap alamat playlist.
 */
export const LOCAL_SCHEME = 'mirai-local://'

export type HlsResourceKind = 'segment' | 'key' | 'map'

/** Satu berkas yang harus diunduh supaya playlist-nya utuh di perangkat. */
export interface HlsResource {
  /** Alamat asli, sudah absolut. */
  url: string
  /** Nama berkasnya di direktori episode. */
  name: string
  kind: HlsResourceKind
}

export interface HlsPlan {
  /** Isi playlist yang sudah menunjuk nama berkas lokal, siap ditulis ke berkas. */
  playlist: string
  resources: HlsResource[]
}

/** Satu pilihan kualitas di master playlist. */
export interface HlsVariant {
  url: string
  /** Label yang ditampilkan dan dicocokkan dengan setelan kualitas. */
  quality: string
  bandwidth: number
  height?: number
}

/** URI yang sudah membawa skema sendiri tidak boleh disentuh resolver. */
const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i

/**
 * URI di playlist boleh relatif (`seg-1.ts`), akar (`/hls/seg-1.ts`), atau
 * relatif protokol (`//cdn/seg-1.ts`). Yang gagal diselesaikan dikembalikan apa
 * adanya — biar kegagalannya muncul waktu diambil, bukan jadi alamat karangan.
 */
export function resolveUri(uri: string, baseUrl: string): string {
  if (ABSOLUTE.test(uri)) return uri
  try {
    return new URL(uri, baseUrl).toString()
  } catch {
    return uri
  }
}

export function isMasterPlaylist(text: string): boolean {
  return /^#EXT-X-STREAM-INF/im.test(text)
}

/**
 * Daftar kualitas dari master playlist.
 *
 * Label diambil dari `NAME` kalau ada, kalau tidak dari tinggi `RESOLUTION`
 * (`720p`) — bentuk itulah yang dicocokkan `pickVideo()` dengan kualitas pilihan
 * pengguna. Yang tidak menyebut keduanya jatuh ke bitrate, karena label kosong
 * membuat pemilih kualitas berisi baris tanpa nama.
 */
export function parseVariants(text: string, baseUrl: string): HlsVariant[] {
  const lines = text.split(/\r?\n/)
  const variants: HlsVariant[] = []

  for (const [index, line] of lines.entries()) {
    if (!/^#EXT-X-STREAM-INF/i.test(line.trim())) continue

    // URI-nya ada di baris berikutnya yang bukan tag dan bukan baris kosong.
    const uri = lines.slice(index + 1).find((next) => next.trim() !== '' && !next.startsWith('#'))
    if (uri === undefined) continue

    const attrs = attributes(line)
    const resolution = attrs['RESOLUTION']
    const height = resolution ? Number.parseInt(resolution.split('x')[1] ?? '', 10) : Number.NaN
    const bandwidth = Number.parseInt(attrs['BANDWIDTH'] ?? '', 10)

    variants.push({
      url: resolveUri(uri.trim(), baseUrl),
      quality:
        attrs['NAME'] ??
        (Number.isFinite(height)
          ? `${height}p`
          : Number.isFinite(bandwidth)
            ? `${Math.round(bandwidth / 1000)}k`
            : 'auto'),
      bandwidth: Number.isFinite(bandwidth) ? bandwidth : 0,
      ...(Number.isFinite(height) ? { height } : {}),
    })
  }

  return variants
}

/**
 * Menyalin playlist dengan setiap URI diganti nama berkas lokalnya.
 *
 * URL yang sama persis muncul berkali-kali di playlist yang wajar — kunci AES
 * biasanya satu untuk seluruh episode — dan tiap kemunculan harus jatuh ke satu
 * berkas yang sama. Karena itu penamaannya lewat peta, bukan penghitung baris.
 */
export function planPlaylist(text: string, baseUrl: string): HlsPlan {
  const resources: HlsResource[] = []
  const names = new Map<string, string>()
  const counts = { segment: 0, key: 0, map: 0 }

  const remember = (url: string, kind: HlsResourceKind): string => {
    const known = names.get(url)
    if (known !== undefined) return known

    counts[kind] += 1
    const name =
      kind === 'segment'
        ? `${String(counts.segment).padStart(4, '0')}${extensionOf(url, '.ts')}`
        : kind === 'key'
          ? `key-${String(counts.key).padStart(2, '0')}.key`
          : `map-${String(counts.map).padStart(2, '0')}${extensionOf(url, '.mp4')}`

    names.set(url, name)
    resources.push({ url, name, kind })
    return name
  }

  const playlist = text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed === '') return line

      if (trimmed.startsWith('#')) {
        const kind = /^#EXT-X-MAP/i.test(trimmed)
          ? 'map'
          : /^#EXT-X-(?:SESSION-)?KEY/i.test(trimmed)
            ? 'key'
            : null
        // `METHOD=NONE` memang tidak punya URI, dan tag lain tidak boleh disentuh.
        return kind === null
          ? line
          : replaceUriAttribute(line, (uri) => remember(resolveUri(uri, baseUrl), kind))
      }

      return remember(resolveUri(trimmed, baseUrl), 'segment')
    })
    .join('\n')

  return { playlist, resources }
}

/**
 * Kebalikan `planPlaylist()`: nama berkas di playlist tersimpan diubah jadi
 * alamat `mirai-local://` yang absolut.
 *
 * Dikerjakan di memori tiap kali episode dibuka, bukan disimpan begitu di
 * berkasnya, karena direktori episode ikut berubah kalau judul atau nama
 * episodenya berubah — playlist yang menyimpan path mutlak akan mati diam-diam.
 */
export function localizePlaylist(text: string, dir: string): string {
  const local = (name: string): string => `${LOCAL_SCHEME}${dir}/${name}`

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed === '') return line

      if (trimmed.startsWith('#')) {
        return /^#EXT-X-(?:MAP|(?:SESSION-)?KEY)/i.test(trimmed)
          ? replaceUriAttribute(line, local)
          : line
      }

      return local(trimmed)
    })
    .join('\n')
}

/** `mirai-local://downloads/…/0001.ts` → `downloads/…/0001.ts`. */
export function localPathOf(url: string): string | null {
  return url.startsWith(LOCAL_SCHEME) ? url.slice(LOCAL_SCHEME.length) : null
}

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Atribut tag HLS: `BANDWIDTH=123,NAME="720p",CODECS="a,b"`.
 *
 * Nilai berkutip boleh berisi koma — karena itu pemisahnya regex, bukan
 * `split(',')` yang akan memotong `CODECS` jadi dua atribut cacat.
 */
function attributes(line: string): Record<string, string> {
  const at = line.indexOf(':')
  const result: Record<string, string> = {}
  if (at === -1) return result

  for (const match of line.slice(at + 1).matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/gi)) {
    const key = match[1]
    const value = match[2] ?? ''
    if (key) result[key.toUpperCase()] = value.replace(/^"|"$/g, '')
  }
  return result
}

function replaceUriAttribute(line: string, map: (uri: string) => string): string {
  return line.replace(/URI="([^"]*)"/i, (whole, uri: string) =>
    uri === '' ? whole : `URI="${map(uri)}"`,
  )
}

/**
 * Ekstensi dari alamat, tanpa query dan fragmen. Yang tidak masuk akal sebagai
 * ekstensi (terlalu panjang, ada karakter aneh) memakai bawaan: nama berkas
 * harus sudah final sebelum satu byte pun turun.
 */
function extensionOf(url: string, fallback: string): string {
  const path = url.split(/[?#]/)[0] ?? ''
  const match = /\.([a-z0-9]{1,5})$/i.exec(path)
  return match?.[1] ? `.${match[1].toLowerCase()}` : fallback
}
