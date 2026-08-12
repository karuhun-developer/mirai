/** Epoch milidetik. Satu-satunya sumber waktu di lapisan DB. */
export function nowMs(): number {
  return Date.now()
}

/**
 * Id entri dibuat deterministik dari sumber + url, bukan acak.
 *
 * Alasannya: entri yang sama ditemui lewat katalog, pencarian, riwayat, dan
 * daftar update. Dengan id acak, keempatnya jadi empat baris berbeda dan
 * progres baca tersebar di antaranya. Dengan id turunan, `INSERT OR IGNORE`
 * sudah cukup jadi jaminan tunggal.
 */
export function entryId(sourceId: string, url: string): string {
  return `${sourceId}::${url}`
}

export function itemId(entry: string, url: string): string {
  return `${entry}::${url}`
}

/** Membaca kembali `sourceId` dan `url` dari id entri. */
export function parseEntryId(id: string): { sourceId: string; url: string } | undefined {
  const cut = id.indexOf('::')
  if (cut <= 0) return undefined
  return { sourceId: id.slice(0, cut), url: id.slice(cut + 2) }
}

/** Id acak untuk baris yang tidak punya identitas alami (kategori, unduhan). */
export function randomId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** SQLite tidak punya boolean; ini satu-satunya tempat konversinya ditulis. */
export function toFlag(value: boolean): number {
  return value ? 1 : 0
}

export function fromFlag(value: number | null | undefined): boolean {
  return value === 1
}
