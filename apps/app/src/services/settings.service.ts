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
  /**
   * Bahasa antarmuka. Kosong berarti "ikuti bahasa perangkat" — pilihan yang
   * disengaja: yang tersimpan cuma keputusan sadar pengguna, sehingga membuka
   * Mirai di perangkat berbahasa Inggris tidak memaksanya berbahasa Indonesia
   * hanya karena itu bawaan aplikasinya.
   */
  locale: string
  /**
   * Mode incognito: riwayat dan progres tidak dicatat selama menyala. Tidak ikut
   * disimpan ke `localStorage` — lihat `save()`.
   */
  incognito: boolean
}

function load(): Settings {
  const empty: Settings = { userAgent: '', locale: '', incognito: false }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      userAgent: typeof parsed.userAgent === 'string' ? parsed.userAgent : '',
      locale: typeof parsed.locale === 'string' ? parsed.locale : '',
      // Sengaja tidak dibaca dari penyimpanan: incognito yang menyala diam-diam
      // sejak dibuka adalah cara kehilangan riwayat tanpa sadar.
      incognito: false,
    }
  } catch {
    // Setelan rusak tidak boleh membuat app gagal dibuka.
    return empty
  }
}

export const settings = reactive<Settings>(load())

watch(
  () => ({ ...settings }),
  ({ incognito: _incognito, ...persisted }) => {
    try {
      // `incognito` tidak ikut disimpan: mode privat yang bertahan lintas sesi
      // berarti berhari-hari riwayat hilang tanpa ada yang menyadari.
      localStorage.setItem(KEY, JSON.stringify(persisted))
    } catch {
      // Kuota penuh atau mode privat: setelan hilang saat reload, app tetap jalan.
    }
  },
)

/** Dipakai transport; dibaca per request supaya perubahan langsung berlaku. */
export function userAgentOverride(): string {
  return settings.userAgent
}
