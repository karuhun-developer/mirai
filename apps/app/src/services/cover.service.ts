import { t } from '@/i18n'
import { transport } from './extensions.service'

/**
 * Cache cover.
 *
 * Tanpa ini library "offline-first" cuma setengah janji: barisnya memang
 * terbaca dari SQLite, tapi seluruh grid berubah jadi kotak abu-abu begitu
 * jaringan mati. Gambarnya disimpan di Cache API — satu-satunya penyimpanan di
 * browser yang menerima `Response` biner berukuran ratusan KB tanpa base64.
 *
 * Berkasnya sengaja **tidak** masuk SQLite: snapshot database web diekspor utuh
 * setiap kali ada perubahan, dan menaruh gambar di dalamnya berarti menulis
 * ulang puluhan MB hanya karena satu chapter ditandai sudah dibaca.
 */

const CACHE = 'mirai-covers-v1'

/**
 * Batas jumlah cover yang disimpan. Cache API mengembalikan kunci dalam urutan
 * penyisipan, jadi yang paling lama masuk adalah yang pertama dibuang — LRU
 * seadanya, tapi tanpa perlu tabel pembantu yang harus dijaga sendiri.
 */
const MAX_ENTRIES = 600

function cacheOpen(): Promise<Cache> | undefined {
  // `caches` tidak ada di konteks non-secure (http:// selain localhost). Di
  // situ cover tetap tampil lewat jaringan; cuma offline-nya yang hilang.
  return typeof caches === 'undefined' ? undefined : caches.open(CACHE)
}

async function evictOverflow(cache: Cache): Promise<void> {
  const keys = await cache.keys()
  const excess = keys.length - MAX_ENTRIES
  if (excess <= 0) return
  await Promise.all(keys.slice(0, excess).map((request) => cache.delete(request)))
}

/**
 * URL yang siap dipasang ke `<img src>`.
 *
 * Kuncinya URL asli dari source, bukan URL proxy: kalau app pindah dari web ke
 * APK (atau alamat proxy-nya berubah), cover yang sudah tersimpan tetap
 * terpakai.
 *
 * Hasilnya `blob:` URL yang **wajib** dilepas dengan `releaseCover()` — objek
 * URL menahan blob-nya di memori sampai dokumen ditutup.
 */
export async function coverUrl(sourceUrl: string): Promise<string> {
  const display = transport.media.toDisplayUrl(sourceUrl)
  const cache = await cacheOpen()
  if (!cache) return display

  const hit = await cache.match(sourceUrl)
  if (hit) return URL.createObjectURL(await hit.blob())

  const response = await fetch(display)
  if (!response.ok) throw new Error(t('errors.coverFetch', { status: response.status }))

  // Disimpan di bawah URL sumbernya sendiri lewat `Request` buatan supaya
  // kuncinya stabil, lalu klon-nya yang dipakai — body `Response` cuma bisa
  // dibaca sekali.
  const blob = await response.blob()
  await cache.put(new Request(sourceUrl), new Response(blob, { headers: response.headers }))
  void evictOverflow(cache)

  return URL.createObjectURL(blob)
}

export function releaseCover(url: string | undefined): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

/** Dipakai Pengaturan: membuang seluruh cover yang tersimpan. */
export async function clearCovers(): Promise<void> {
  if (typeof caches !== 'undefined') await caches.delete(CACHE)
}
