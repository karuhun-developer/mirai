import { Capacitor } from '@capacitor/core'
import { DefaultWebViewOptions, InAppBrowser } from '@capacitor/inappbrowser'
import { userAgentOverride } from './settings.service'

/**
 * Membuka halaman luar — halaman tantangan Cloudflare dan host `embed` pemutar.
 *
 * Di APK keduanya **wajib** lewat WebView aplikasi, bukan Chrome Custom Tabs dan
 * bukan peramban luar. Alasannya cookie: `CapacitorHttp` mengeksekusi request
 * extension di sisi native dan memakai `CookieManager` milik WebView aplikasi.
 * Custom Tabs punya penyimpanannya sendiri, jadi `cf_clearance` yang didapat di
 * sana tidak pernah terbaca request berikutnya — verifikasinya selesai, dan
 * sumbernya tetap tertahan. Sama halnya dengan host `embed` yang menuntut cookie
 * sesi sebelum mau memutar.
 *
 * Di web tidak ada pilihan lain selain tab baru, dan itu memang tidak menolong
 * untuk Cloudflare — lihat [cloudflare.md](../../../../docs/features/cloudflare.md).
 */

/**
 * `isIsolated: false` bukan detail yang bisa diabaikan.
 *
 * Bawaannya `true`, yang menjalankan WebView plugin di proses terpisah dengan
 * direktori data sendiri — Android memang melarang dua proses memakai satu
 * direktori data WebView. Konsekuensinya cookie-nya juga terpisah, dan itu
 * persis satu-satunya hal yang kita butuhkan dari WebView ini.
 *
 * `clearCache`/`clearSessionCache` dibiarkan mati dengan alasan yang sama:
 * membersihkan cookie sebelum membuka berarti menghapus verifikasi yang mungkin
 * masih berlaku dari kunjungan sebelumnya.
 */
function webViewOptions(): typeof DefaultWebViewOptions {
  const userAgent = userAgentOverride().trim()

  return {
    ...DefaultWebViewOptions,
    showURL: true,
    showToolbar: true,
    clearCache: false,
    clearSessionCache: false,
    // Halaman `embed` justru dibuka untuk diputar; menahan autoplay di sini
    // berarti satu ketukan tambahan untuk sesuatu yang sudah diminta pengguna.
    mediaPlaybackRequiresUserAction: false,
    closeButtonText: 'Tutup',
    android: { ...DefaultWebViewOptions.android, isIsolated: false },
    // UA yang dipakai verifikasi harus sama dengan UA request extension,
    // kalau tidak `cf_clearance`-nya ditolak. Kosong = biarkan WebView memakai
    // UA aslinya, yang juga dipakai `CapacitorHttp` waktu tidak ditimpa.
    ...(userAgent === '' ? {} : { customWebViewUserAgent: userAgent }),
  }
}

/**
 * Membuka `url` di WebView aplikasi (APK) atau tab baru (web).
 *
 * Tidak melempar: gagal membuka halaman luar tidak boleh mematikan layar yang
 * memanggilnya, dan pengguna tetap melihat alamatnya di kartu yang sama.
 */
export async function openExternal(url: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  try {
    await InAppBrowser.openInWebView({ url, options: webViewOptions() })
  } catch {
    // Plugin tidak terpasang di platform ini — jalur terakhir yang selalu ada.
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Menunggu WebView-nya ditutup pengguna; di web langsung selesai.
 *
 * Dipakai kartu tantangan Cloudflare untuk mencoba lagi tepat setelah orangnya
 * kembali — bukan lewat tombol "muat ulang" kedua yang harus ditemukan sendiri.
 * Pendengarnya dilepas setelah sekali terpanggil: layar bisa ditinggalkan kapan
 * saja, dan pendengar yang menumpuk membuat satu penutupan WebView memicu
 * belasan pemuatan ulang sekaligus.
 */
export async function whenExternalClosed(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  let closed = (): void => {}
  const waiting = new Promise<void>((resolve) => {
    closed = resolve
  })

  const handle = await InAppBrowser.addListener('browserClosed', closed)
  await waiting
  await handle.remove()
}
