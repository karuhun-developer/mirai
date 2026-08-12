import { SourceCallError } from '@mirai/extension-runtime'
import { openExternal, whenExternalClosed } from './browser.service'
import { transport } from './extensions.service'

/**
 * Tantangan Cloudflare: apa yang bisa dan tidak bisa dilakukan aplikasi ini.
 *
 * Sikapnya sama dengan Aniyomi — tantangan **tidak** diputari otomatis. Yang
 * disediakan cuma jalan supaya penggunanya sendiri yang menyelesaikan "verify
 * you are human", persis alur `Browse → sumber → ikon WebView → selesaikan
 * CAPTCHA → tutup` di sana. Kalau setelah itu masih tertahan, sumber itu memang
 * tidak bisa dipakai, dan aplikasi mengatakannya terang-terangan alih-alih
 * memutar-mutar percobaan.
 *
 * Yang membuat alur itu berhasil di Android adalah satu hal teknis: request
 * extension dijalankan `CapacitorHttp` di sisi native, yang berbagi cookie jar
 * dengan WebView aplikasi. Cookie `cf_clearance` hasil verifikasi karena itu
 * ikut terpakai oleh request berikutnya — asal UA-nya sama, lihat setelan
 * User-Agent di Pengaturan.
 */

export interface ChallengeInfo {
  /** Halaman yang harus dibuka pengguna. */
  url: string
  /** Verifikasi manual ada gunanya di sini, atau cuma membuang waktu. */
  canSolve: boolean
}

/**
 * Mengenali kegagalan tantangan dari error yang sudah melintas dua batas worker.
 * Memakai properti, bukan `instanceof`: prototipenya tidak ikut menyeberang.
 */
export function challengeOf(error: unknown): ChallengeInfo | undefined {
  const url =
    error instanceof SourceCallError
      ? error.challengeUrl
      : ((error as { challengeUrl?: unknown } | null)?.challengeUrl as string | undefined)

  if (typeof url !== 'string' || url === '') return undefined
  return { url, canSolve: transport.isNative }
}

/**
 * Membuka halaman tantangan, lalu menunggu penggunanya kembali.
 *
 * Yang menunggu itu ada gunanya cuma di APK: WebView-nya ditutup berarti
 * verifikasinya sudah dicoba, jadi layar pemanggil bisa langsung memuat ulang
 * tanpa menyuruh orangnya mencari tombol kedua. Di web `whenExternalClosed()`
 * selesai seketika — tab baru tidak punya "ditutup" yang bisa ditunggu.
 *
 * **Di build web ini tidak akan menolong, dan itu bukan bug yang bisa
 * diperbaiki.** Request extension dikirim `apps/proxy` dari sisi server,
 * sedangkan `cf_clearance` yang didapat browser terikat ke IP dan UA yang
 * menyelesaikan tantangan. Cookie itu tidak pernah sampai ke proxy — dan tidak
 * ada cara membuatnya sampai tanpa mematikan alasan cookie itu ada. Tombolnya
 * tetap ada supaya pengguna bisa memastikan sendiri situsnya memang menantang,
 * tapi teksnya menyebutkan batas ini.
 */
export async function openChallenge(url: string): Promise<void> {
  // WebView aplikasi, bukan Custom Tabs: cuma WebView yang berbagi cookie jar
  // dengan `CapacitorHttp`. Aturan itu beserta alasannya ada di
  // `browser.service.ts`, satu tempat untuk semua halaman luar.
  await openExternal(url)
  await whenExternalClosed()
}
