/**
 * Repo extension: satu URL yang menunjuk ke hasil `extensions/scripts/build.ts`
 * — `index.min.json` plus `js/<pkg>.js` di sebelahnya. Persis pola keiyoushi,
 * jadi siapa pun bisa menerbitkan repo sendiri tanpa menyentuh kode Mirai.
 *
 * Berkas index datang dari server asing, jadi seluruh isinya divalidasi di sini
 * sebelum menyentuh penyimpanan atau UI. Kalau tidak, satu repo jahil cukup
 * menaruh `hosts: "*"` atau `apiVersion: "banyak"` untuk membuat app melakukan
 * hal yang tidak diniatkan.
 */

export interface RepoSourceInfo {
  id: string
  name: string
  lang: string
  kind: 'manga' | 'anime'
  baseUrl: string
  supportsLatest: boolean
  nsfw: boolean
}

/** Satu baris `index.min.json`. Bentuknya dikunci `extensions/scripts/build.ts`. */
export interface RepoEntry {
  pkg: string
  name: string
  lang: string
  version: string
  apiVersion: number
  nsfw: boolean
  hosts: string[]
  /** Relatif terhadap URL repo, mis. `js/mangadex.js`. */
  file: string
  icon?: string
  sources: RepoSourceInfo[]
}

const INDEX_FILE = 'index.min.json'

/**
 * Pengguna menempelkan apa saja: URL index-nya langsung, URL dengan slash di
 * ujung, atau alamat folder. Ketiganya dinormalkan ke bentuk folder tanpa slash
 * supaya perbandingan "repo ini sudah ada" tidak gagal karena beda satu karakter.
 */
export function normalizeRepoUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('URL repo kosong')

  const withoutIndex = trimmed.replace(new RegExp(`/?${INDEX_FILE}$`), '')
  const url = withoutIndex.replace(/\/+$/, '')

  // Path relatif (`/ext-dev`) dibiarkan: itu repo pengembangan yang disajikan
  // Vite dari origin yang sama.
  if (url.startsWith('/')) return url

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Bukan URL yang sah: ${trimmed}`)
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Protokol ${parsed.protocol} tidak didukung untuk repo extension`)
  }

  return url
}

export function repoAssetUrl(repoUrl: string, path: string): string {
  return `${repoUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * Index diambil dengan `fetch` biasa, bukan lewat proxy: repo extension adalah
 * berkas statis yang memang dimaksudkan untuk dibaca browser, dan gh-pages
 * mengirim `Access-Control-Allow-Origin: *`. Melewatkannya ke proxy justru
 * memaksa pengguna mendaftarkan host repo di allowlist yang dipakai untuk
 * situs sumber.
 */
export async function fetchRepoIndex(repoUrl: string): Promise<RepoEntry[]> {
  const url = repoAssetUrl(repoUrl, INDEX_FILE)

  let response: Response
  try {
    response = await fetch(url, { cache: 'no-cache' })
  } catch (cause) {
    // Kegagalan CORS dan kegagalan jaringan sama-sama muncul sebagai TypeError
    // tanpa detail, jadi keduanya disebut di pesan; `cause` dibawa supaya
    // aslinya masih terlihat di konsol.
    throw new Error(
      `Tidak bisa menghubungi ${url}. ` +
        'Cek koneksi, atau repo itu mungkin tidak mengizinkan akses lintas origin.',
      { cause },
    )
  }

  if (!response.ok) throw new Error(`Repo menjawab ${response.status} untuk ${INDEX_FILE}`)

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(`${INDEX_FILE} bukan JSON yang sah — apa URL-nya benar repo extension?`)
  }

  return parseIndex(data)
}

// --- Validasi ---------------------------------------------------------------

function parseIndex(data: unknown): RepoEntry[] {
  if (!Array.isArray(data)) throw new Error(`${INDEX_FILE} harus berupa daftar paket`)
  return data.map((raw, position) => parseEntry(raw, position))
}

function parseEntry(raw: unknown, position: number): RepoEntry {
  const at = `paket ke-${position + 1}`
  const record = asRecord(raw, at)

  const pkg = text(record, 'pkg', at)
  const where = `paket ${pkg}`

  const hosts = list(record, 'hosts', where).map((host, index) =>
    typeof host === 'string' && host
      ? host
      : fail(`${where}: hosts[${index}] bukan hostname yang sah`),
  )
  if (hosts.length === 0) fail(`${where}: "hosts" kosong, semua request akan ditolak proxy`)

  const apiVersion = record['apiVersion']
  if (typeof apiVersion !== 'number' || !Number.isInteger(apiVersion)) {
    fail(`${where}: "apiVersion" harus bilangan bulat`)
  }

  const sources = list(record, 'sources', where).map((source, index) =>
    parseSource(source, `${where}: sources[${index}]`),
  )
  if (sources.length === 0) fail(`${where}: tidak mendaftarkan satu source pun`)

  const icon = record['icon']

  return {
    pkg,
    name: text(record, 'name', where),
    lang: text(record, 'lang', where),
    version: text(record, 'version', where),
    apiVersion: apiVersion as number,
    nsfw: record['nsfw'] === true,
    hosts,
    file: text(record, 'file', where),
    ...(typeof icon === 'string' && icon ? { icon } : {}),
    sources,
  }
}

function parseSource(raw: unknown, where: string): RepoSourceInfo {
  const record = asRecord(raw, where)
  const kind = record['kind']
  if (kind !== 'manga' && kind !== 'anime') fail(`${where}: "kind" harus manga atau anime`)

  return {
    id: text(record, 'id', where),
    name: text(record, 'name', where),
    lang: text(record, 'lang', where),
    kind: kind as 'manga' | 'anime',
    baseUrl: text(record, 'baseUrl', where),
    supportsLatest: record['supportsLatest'] === true,
    nsfw: record['nsfw'] === true,
  }
}

function fail(message: string): never {
  throw new Error(message)
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${where}: bukan objek`)
  }
  return value as Record<string, unknown>
}

function text(record: Record<string, unknown>, key: string, where: string): string {
  const value = record[key]
  if (typeof value !== 'string' || !value) fail(`${where}: "${key}" wajib diisi`)
  return value as string
}

function list(record: Record<string, unknown>, key: string, where: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) fail(`${where}: "${key}" wajib berupa daftar`)
  return value
}
