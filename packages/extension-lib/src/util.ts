import type { HttpHeaders } from '@mirai/extension-api'

/**
 * UA desktop yang lazim. Sebagian situs sumber menyajikan markup berbeda —
 * kadang tanpa daftar chapter sama sekali — untuk UA WebView bawaan Android.
 */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** Header yang diminta CDN gambar/video: mereka memeriksa dari mana request datang. */
export function refererHeaders(baseUrl: string): HttpHeaders {
  return { 'User-Agent': DEFAULT_USER_AGENT, Referer: `${baseUrl}/` }
}

/** Menyusun query string tanpa memasukkan nilai kosong. */
export function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    search.append(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/**
 * Mengambil angka pertama dari sebuah judul chapter/episode ("Chapter 12.5" →
 * 12.5). Mengembalikan `undefined` kalau tidak ada, supaya host tahu harus
 * mengurutkan berdasarkan urutan asli, bukan berdasarkan nol.
 */
export function parseNumber(value: string): number | undefined {
  const match = /(\d+(?:[.,]\d+)?)/.exec(value)
  if (!match?.[1]) return undefined
  const parsed = Number.parseFloat(match[1].replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

/** ISO 8601 → epoch milidetik; `undefined` kalau tidak bisa dibaca. */
export function parseIsoDate(value: string | undefined | null): number | undefined {
  if (!value) return undefined
  const time = Date.parse(value)
  return Number.isNaN(time) ? undefined : time
}

/**
 * Membuang properti bernilai `undefined`.
 *
 * `exactOptionalPropertyTypes` membedakan "properti tidak ada" dari "properti
 * bernilai undefined", sementara parser hampir selalu menghasilkan yang kedua.
 * Tipe parameternya melonggarkan itu di satu tempat, alih-alih memaksa tiap
 * penulis extension menyusun objeknya secara kondisional.
 */
export function compact<T extends object>(value: { [K in keyof T]: T[K] | undefined }): T {
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) result[key] = item
  }
  return result as T
}

/** Menjalankan `task` untuk tiap item dengan batas konkurensi, urutan hasil tetap. */
export async function mapLimit<I, O>(
  items: readonly I[],
  limit: number,
  task: (item: I, index: number) => Promise<O>,
): Promise<O[]> {
  const results = new Array<O>(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++
      const item = items[index]
      if (index >= items.length || item === undefined) return
      results[index] = await task(item, index)
    }
  })

  await Promise.all(workers)
  return results
}
