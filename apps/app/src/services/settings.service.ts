import { reactive, watch } from 'vue'

/**
 * Setelan aplikasi yang harus terbaca **sebelum** Pinia hidup.
 *
 * `createTransport()` dipanggil saat modul `extensions.service.ts` dievaluasi,
 * jauh sebelum komponen mana pun ada, jadi setelan yang memengaruhi jaringan
 * tidak bisa tinggal di store. Yang di sini sengaja sedikit; sisanya (tema, mode
 * baca, kualitas video) menyusul sebagai store biasa di fase berikutnya.
 */

const KEY = 'mirai.settings'

/**
 * Kandidat UA yang ditawarkan tombol "Pakai UA browser ini".
 *
 * Di web, UA yang paling masuk akal adalah UA browser yang sedang dipakai —
 * request tetap dikirim proxy, tapi setidaknya identitasnya konsisten. Di APK
 * nanti nilai yang benar adalah UA WebView-nya sendiri, karena cookie hasil
 * verifikasi Cloudflare terikat ke UA yang menyelesaikannya.
 */
export function browserUserAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent
}

export interface Settings {
  /**
   * Menimpa `User-Agent` semua extension. Kosong = biarkan extension memilih
   * sendiri, dan itu bawaannya: menimpa UA bisa mengubah markup yang dikirim
   * situs sumber, jadi ini alat diagnosis, bukan setelan yang perlu disentuh
   * kalau semuanya sudah jalan.
   */
  userAgent: string
}

function load(): Settings {
  const empty: Settings = { userAgent: '' }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { userAgent: typeof parsed.userAgent === 'string' ? parsed.userAgent : '' }
  } catch {
    // Setelan rusak tidak boleh membuat app gagal dibuka.
    return empty
  }
}

export const settings = reactive<Settings>(load())

watch(
  () => ({ ...settings }),
  (value) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(value))
    } catch {
      // Kuota penuh atau mode privat: setelan hilang saat reload, app tetap jalan.
    }
  },
)

/** Dipakai transport; dibaca per request supaya perubahan langsung berlaku. */
export function userAgentOverride(): string {
  return settings.userAgent
}
