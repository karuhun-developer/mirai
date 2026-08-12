/**
 * Gerbang SSRF.
 *
 * URL yang sampai ke proxy ditentukan kode extension pihak ketiga. Tanpa
 * gerbang ini, satu extension jahat cukup meminta `http://169.254.169.254/…`
 * atau `http://localhost:5432` dan proxy dengan patuh mengambilkannya dari
 * dalam jaringan tempat dia berjalan.
 */

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
]

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost'])

export class BlockedUrlError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'BlockedUrlError'
  }
}

export interface GuardOptions {
  /**
   * Host yang boleh dihubungi, berasal dari `hosts[]` manifest extension.
   * Kosong berarti **tolak semua**. Gagal tertutup: proxy yang ter-deploy tanpa
   * konfigurasi harus jadi tembok, bukan open relay.
   */
  allowedHosts: readonly string[]
}

/** `example.com` juga mengizinkan `cdn.example.com`, tapi bukan `notexample.com`. */
function hostMatches(hostname: string, allowed: string): boolean {
  return hostname === allowed || hostname.endsWith(`.${allowed}`)
}

function isPrivateAddress(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true
  if (PRIVATE_V4.some((pattern) => pattern.test(hostname))) return true

  // IPv6 literal datang dalam kurung siku; ::1 dan fc00::/7 sama berbahayanya.
  const bare = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (bare === '::1' || bare === '::') return true
  if (/^f[cd][0-9a-f]{2}:/.test(bare)) return true
  if (/^fe80:/.test(bare)) return true
  // Alamat IPv4-mapped memutari pemeriksaan di atas. `new URL()` menormalkan
  // `::ffff:127.0.0.1` jadi bentuk heksa `::ffff:7f00:1`, jadi dua-duanya harus
  // dikenali — bentuk desimal saja tidak cukup.
  const mapped = mappedV4(bare)
  if (mapped) return isPrivateAddress(mapped)

  return false
}

/** Mengubah ekor `::ffff:*` jadi notasi titik, atau `null` kalau bukan IPv4-mapped. */
function mappedV4(bare: string): string | null {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(bare)
  if (dotted?.[1]) return dotted[1]

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(bare)
  if (!hex?.[1] || !hex[2]) return null

  const high = Number.parseInt(hex[1], 16)
  const low = Number.parseInt(hex[2], 16)
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`
}

/**
 * Memvalidasi URL tujuan. Melempar `BlockedUrlError` kalau ditolak — pemanggil
 * menerjemahkannya jadi 403, bukan 500, supaya jelas ini kebijakan, bukan bug.
 */
export function assertAllowed(rawUrl: string, options: GuardOptions): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BlockedUrlError('URL tidak valid')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError(`Protokol ${url.protocol} tidak diizinkan`)
  }

  if (isPrivateAddress(url.hostname.toLowerCase())) {
    throw new BlockedUrlError('Alamat jaringan internal tidak boleh diakses lewat proxy')
  }

  const hostname = url.hostname.toLowerCase()
  if (!options.allowedHosts.some((allowed) => hostMatches(hostname, allowed))) {
    throw new BlockedUrlError(`Host ${hostname} tidak ada di allowlist proxy`)
  }

  return url
}

/**
 * Redirect bisa memindahkan request ke host lain — termasuk ke alamat internal.
 * Karena itu redirect ditangani manual dan tiap lompatan diperiksa ulang.
 */
export const MAX_REDIRECTS = 5
