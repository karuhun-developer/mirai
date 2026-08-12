import type { HttpClient, HttpResponse } from '@mirai/extension-api'
import { CloudflareChallengeError, HttpError } from '@mirai/extension-api'

/**
 * Pengenalan tantangan Cloudflare.
 *
 * Tanpa ini, halaman tantangan sampai ke extension sebagai "403" polos, parser
 * gagal menemukan selector apa pun, dan yang muncul di layar adalah pesan yang
 * menyalahkan extension untuk keadaan yang sama sekali bukan salahnya. Bedanya
 * penting: 403 biasa artinya perbaiki kodenya, tantangan artinya penggunanya
 * yang harus menyelesaikan verifikasi.
 */

/**
 * Header `cf-mitigated: challenge` adalah pernyataan resmi Cloudflare bahwa
 * request ditahan tantangan — itu sinyal paling kuat yang ada. Sisanya penanda
 * di badan halaman tantangan, untuk zona yang belum mengirim header itu.
 */
const BODY_MARKERS = [
  '__cf_chl', // skrip tantangan (`__cf_chl_opt`, `__cf_chl_tk`)
  'challenge-platform', // /cdn-cgi/challenge-platform/…
  'cf-browser-verification', // IUAM gaya lama
  'Just a moment', // <title> halaman tunggu
  'Attention Required! | Cloudflare',
]

/**
 * Status yang dipakai Cloudflare untuk menahan: 403 (managed challenge dan
 * blokir), 503 (IUAM lama), 429 (rate limit berbentuk tantangan). Status di
 * luar itu tidak pernah dianggap tantangan sekalipun badannya mirip — halaman
 * 200 yang kebetulan memuat kata "Just a moment" adalah konten, bukan gerbang.
 */
const CHALLENGE_STATUSES = new Set([403, 429, 503])

export function isCloudflareChallenge(res: HttpResponse): boolean {
  if (!CHALLENGE_STATUSES.has(res.status)) return false

  const mitigated = res.headers['cf-mitigated']
  if (mitigated !== undefined && mitigated.toLowerCase().includes('challenge')) return true

  // Penanda badan saja tidak cukup: situs mana pun boleh memuat teks itu.
  // Harus ada bukti bahwa yang menjawab memang Cloudflare.
  const fromCloudflare =
    (res.headers['server'] ?? '').toLowerCase().includes('cloudflare') ||
    res.headers['cf-ray'] !== undefined
  if (!fromCloudflare) return false

  return BODY_MARKERS.some((marker) => res.body.includes(marker))
}

/**
 * URL yang layak dibuka pengguna: origin situsnya, bukan endpoint yang
 * kebetulan kena. Tantangan dipasang per zona, jadi menyelesaikannya di halaman
 * depan sama sahnya — dan halaman depan jauh lebih mungkin merender sesuatu
 * yang masuk akal daripada sebuah endpoint JSON.
 */
function challengePageOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

/**
 * Membungkus transport supaya tantangan berhenti di sini, bukan merambat ke
 * dalam parser extension sebagai HTML yang tidak dikenali.
 */
export function withCloudflareDetection(client: HttpClient): HttpClient {
  function check(res: HttpResponse): HttpResponse {
    if (isCloudflareChallenge(res)) {
      throw new CloudflareChallengeError(res.status, res.url, challengePageOf(res.url))
    }
    return res
  }

  return {
    ...client,
    async request(req) {
      return check(await client.request(req))
    },
    async get(url, headers) {
      return check(await client.get(url, headers))
    },
    async post(url, body, headers) {
      return check(await client.post(url, body, headers))
    },
    async getJson(url, headers) {
      // `getJson` tidak mengembalikan respons mentah, jadi pemeriksaannya
      // dilakukan lewat `get` dan hasilnya di-parse di sini — kalau tidak,
      // API JSON di balik Cloudflare akan gagal sebagai "JSON tidak valid".
      const res = check(await client.get(url, headers))
      if (!res.ok) throw new HttpError(res.status, res.url)
      return JSON.parse(res.body) as unknown
    },
  }
}
