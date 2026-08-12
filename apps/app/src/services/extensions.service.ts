import { API_VERSION } from '@mirai/extension-api'
import {
  ExtensionInstance,
  bindSources,
  createTransport,
  type PreferenceSnapshot,
  type RemoteSource,
  type Transport,
} from '@mirai/extension-runtime'
import type { RepoEntry } from './extensionRepo.service'
import { repoAssetUrl } from './extensionRepo.service'
import type { InstalledRecord } from './extensionStorage.service'
import { readBundle, writeBundle } from './extensionStorage.service'

/**
 * Jembatan antara app dan runtime extension. Satu-satunya tempat app tahu soal
 * transport, Worker, dan bundel; sisanya cuma memakai `RemoteSource`.
 */

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:5181'

export const transport: Transport = createTransport({ proxyUrl: PROXY_URL })

export interface LoadedExtension {
  pkg: string
  instance: ExtensionInstance
  sources: RemoteSource[]
}

/**
 * Extension yang menargetkan API lain akan gagal dengan cara yang membingungkan
 * — metode hilang, bentuk data beda — jadi ditolak di depan dengan pesan yang
 * menyebut angkanya. Ini juga yang membuat repo boleh memuat paket untuk versi
 * Mirai berikutnya tanpa merusak versi terpasang.
 */
export function compatibilityError(entry: RepoEntry): string | undefined {
  if (entry.apiVersion === API_VERSION) return undefined
  return entry.apiVersion > API_VERSION
    ? `Butuh Mirai yang lebih baru (apiVersion ${entry.apiVersion}, app ini ${API_VERSION})`
    : `Extension usang (apiVersion ${entry.apiVersion}, app ini ${API_VERSION})`
}

/**
 * Bundel diambil dari cache dulu. Itu bukan sekadar hemat kuota: library harus
 * tetap bisa dibuka waktu offline, dan tanpa kode extension-nya daftar sumber
 * jadi kosong meski entrinya ada di database.
 */
export async function fetchBundle(repoUrl: string, entry: RepoEntry): Promise<string> {
  const cached = await readBundle(entry.pkg, entry.version)
  if (cached !== undefined) return cached

  const url = repoAssetUrl(repoUrl, entry.file)
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`Gagal mengunduh ${entry.pkg} dari ${url} (${response.status})`)

  const code = await response.text()
  await writeBundle(entry.pkg, entry.version, code)
  return code
}

/**
 * Menjalankan satu paket di Worker-nya sendiri.
 *
 * Kode-nya diambil host lalu diserahkan ke worker sebagai string; worker tidak
 * pernah mengunduh sendiri. Dengan begitu satu-satunya jalur keluar tetap
 * `ctx.http`, dan transport yang dipakai tetap yang dipilih host.
 */
export async function activate(
  record: InstalledRecord,
  prefs: PreferenceSnapshot,
): Promise<LoadedExtension> {
  const incompatible = compatibilityError(record.entry)
  if (incompatible) throw new Error(incompatible)

  const code = await fetchBundle(record.repoUrl, record.entry)

  const instance = new ExtensionInstance(transport.http)
  await instance.load({ code, apiVersion: record.entry.apiVersion, prefs })

  return { pkg: record.pkg, instance, sources: bindSources(instance) }
}
