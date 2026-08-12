import type HlsJs from 'hls.js'
import { mediaUrl } from './extensions.service'
import { createLocalLoader, createProxyLoader, type LoaderConstructor } from './hlsLoader'
import type { PlayableVideo } from './playback'
import { fileUrl, revokeFileUrl } from './storage.service'

/**
 * Memasang satu pilihan video ke elemen `<video>`.
 *
 * Semua yang berbau hls.js dikurung di berkas ini, dan pustakanya dimuat lewat
 * `import()` dinamis: pemutar HLS itu ±400 kB, dan orang yang cuma membaca manga
 * tidak perlu mengunduhnya sama sekali. Berkas ini juga yang menentukan jalur
 * mana yang dipakai — hls.js, HLS bawaan browser, atau `src` biasa — supaya
 * store dan komponen tidak perlu tahu bedanya.
 */

export interface AttachedVideo {
  /** Melepas pemutar dan sumbernya. Aman dipanggil berkali-kali. */
  detach(): void
}

/** Alasan gagal yang sudah diterjemahkan; store tinggal menampilkannya. */
export type FatalHandler = (message: string) => void

const NATIVE_HLS = 'application/vnd.apple.mpegurl'

export async function attachVideo(
  el: HTMLVideoElement,
  video: PlayableVideo,
  onFatal: FatalHandler,
): Promise<AttachedVideo> {
  // Berkas yang sudah di perangkat (`blob:`, `capacitor:`) lewat apa adanya —
  // itu sudah aturan `mediaUrl` sendiri; sisanya ikut aturan transport.
  const resolve = (url: string): string => mediaUrl(url, video.headers)

  if (video.type !== 'hls') {
    el.src = resolve(video.url)
    return { detach: () => clearSource(el) }
  }

  const { default: Hls } = await import('hls.js')

  if (!Hls.isSupported()) {
    // Safari (dan WebView iOS) memutar HLS sendiri tanpa Media Source. Di sini
    // playlist-nya terpaksa diserahkan apa adanya — kalau isinya URL relatif dan
    // jalurnya lewat proxy, segmennya tidak akan ketemu. Belum ada jalan lain
    // selain ini; di native resolvernya identitas, jadi tidak jadi masalah.
    // Episode terunduh tidak punya jalan lain di sini: segmennya bukan alamat
    // jaringan, dan pemutar bawaan tidak bisa dititipi loader.
    if (video.local) {
      onFatal('Browser ini tidak bisa memutar episode HLS yang terunduh.')
      return { detach: () => {} }
    }

    if (el.canPlayType(NATIVE_HLS) !== '') {
      el.src = resolve(video.url)
      return { detach: () => clearSource(el) }
    }

    onFatal('Browser ini tidak bisa memutar HLS.')
    return { detach: () => {} }
  }

  const hls = new Hls({
    // Dua loader ditumpuk, bukan dipilih salah satu. Yang di luar menangani
    // alamat `mirai-local://` di playlist terunduh; sisanya — termasuk playlist
    // `blob:` yang membungkusnya — jatuh ke loader proxy di dalamnya. Dengan
    // begitu tidak ada percabangan "sedang offline atau tidak" di sini, dan
    // episode setengah terunduh pun tetap punya jalur yang benar per berkas.
    loader: createLocalLoader(
      createProxyLoader(
        // hls.js mendeskripsikan loader-nya lebih rinci daripada yang dibutuhkan
        // pembungkusnya; bentuk minimal itu yang membuat `hlsLoader` bisa diuji
        // tanpa memuat pustakanya sama sekali.
        Hls.DefaultConfig.loader as unknown as LoaderConstructor,
        resolve,
      ),
      fileUrl,
      revokeFileUrl,
    ) as unknown as typeof Hls.DefaultConfig.loader,
    // Pemulihan ditangani sendiri di bawah supaya kegagalan yang benar-benar
    // buntu sampai ke pengguna, bukan berputar diam-diam selamanya.
    enableWorker: true,
  })

  attachErrorHandling(Hls, hls, onFatal)
  hls.loadSource(video.url)
  hls.attachMedia(el)

  return {
    detach: () => {
      hls.destroy()
      clearSource(el)
    },
  }
}

/**
 * Kegagalan HLS hampir selalu bisa dipulihkan sekali: segmen yang putus di
 * tengah jalan cukup dimuat ulang, dan buffer yang rusak cukup di-reset. Yang
 * tidak boleh terjadi adalah memulihkan tanpa henti — video yang diam sambil
 * mencoba ulang selamanya lebih buruk daripada pesan error. Karena itu tiap
 * jenis kegagalan cuma dapat satu kesempatan.
 */
function attachErrorHandling(Hls: typeof HlsJs, hls: HlsJs, onFatal: FatalHandler): void {
  let networkRetried = false
  let mediaRecovered = false

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return

    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !networkRetried) {
      networkRetried = true
      hls.startLoad()
      return
    }

    if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
      mediaRecovered = true
      hls.recoverMediaError()
      return
    }

    hls.destroy()
    onFatal(
      data.type === Hls.ErrorTypes.NETWORK_ERROR
        ? 'Video tidak bisa diambil. Cek jaringan atau coba host lain.'
        : `Video gagal diputar (${data.details}).`,
    )
  })
}

/**
 * Sekadar `el.src = ''` menyisakan unduhan yang masih berjalan di latar. Atribut
 * harus dicabut lalu `load()` dipanggil supaya browser benar-benar berhenti.
 */
function clearSource(el: HTMLVideoElement): void {
  el.removeAttribute('src')
  el.load()
}
