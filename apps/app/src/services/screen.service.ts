import { Capacitor } from '@capacitor/core'

/**
 * Layar penuh dan kunci orientasi.
 *
 * Keduanya "boleh gagal": browser menolak fullscreen yang tidak dipicu gestur
 * pengguna, dan di web tidak ada API kunci orientasi yang bisa diandalkan.
 * Karena itu setiap fungsi di sini menelan errornya — reader yang tidak jadi
 * layar penuh masih reader yang bisa dipakai, sedangkan pengecualian yang
 * dilempar ke atas akan membatalkan pembukaan chapternya.
 */

const native = Capacitor.isNativePlatform()

export async function enterFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
  } catch {
    // Ditolak browser (bukan dari gestur, atau iOS Safari yang memang tidak
    // mendukungnya di elemen non-video). Reader tetap jalan.
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    // Sama: keluar dari layar penuh bukan syarat apa pun.
  }
}

/**
 * Kunci orientasi. Pluginnya di-`import()` dinamis dan hanya di native —
 * build web tidak perlu ikut membawa kode plugin yang tidak akan pernah
 * dipanggil, pola yang sama dengan driver database.
 */
export async function lockOrientation(mode: 'portrait' | 'landscape'): Promise<void> {
  if (!native) return
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation')
    await ScreenOrientation.lock({ orientation: mode })
  } catch {
    // Perangkat yang tidak mengizinkan penguncian tetap boleh membaca.
  }
}

export async function unlockOrientation(): Promise<void> {
  if (!native) return
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation')
    await ScreenOrientation.unlock()
  } catch {
    // Idem.
  }
}
