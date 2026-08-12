import {
  ExtensionInstance,
  bindSources,
  createTransport,
  type RemoteSource,
  type Transport,
} from '@mirai/extension-runtime'

/**
 * Jembatan antara app dan runtime extension. Satu-satunya tempat app tahu soal
 * transport, repo, dan Worker; sisanya cuma memakai `RemoteSource`.
 */

/** Bentuk satu baris `index.min.json` yang dihasilkan `extensions/scripts/build.ts`. */
export interface RepoEntry {
  pkg: string
  name: string
  lang: string
  version: string
  apiVersion: number
  nsfw: boolean
  hosts: string[]
  file: string
}

export interface InstalledExtension {
  entry: RepoEntry
  instance: ExtensionInstance
  sources: RemoteSource[]
}

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:5181'

/**
 * Repo bawaan selama pengembangan; disajikan Vite dari `extensions/dist`.
 * Mulai Fase 2 daftar repo datang dari setelan pengguna.
 */
const REPO_URL = import.meta.env.VITE_EXT_REPO_URL ?? '/ext-dev'

export const transport: Transport = createTransport({ proxyUrl: PROXY_URL })

function repoUrl(path: string): string {
  return `${REPO_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

export async function fetchRepoIndex(): Promise<RepoEntry[]> {
  const response = await fetch(repoUrl('index.min.json'), { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(
      `Repo extension tidak terbaca (${response.status}). ` +
        'Jalankan `pnpm --filter @mirai/extensions build` dulu.',
    )
  }
  return (await response.json()) as RepoEntry[]
}

/**
 * Kode extension diambil host, lalu diserahkan ke worker sebagai string. Worker
 * tidak pernah mengunduh sendiri — dengan begitu satu-satunya jalur keluar
 * tetap `ctx.http`, dan transport yang dipakai tetap yang dipilih host.
 */
export async function install(entry: RepoEntry): Promise<InstalledExtension> {
  const response = await fetch(repoUrl(entry.file), { cache: 'no-cache' })
  if (!response.ok) throw new Error(`Gagal mengunduh ${entry.pkg} (${response.status})`)

  const instance = new ExtensionInstance(transport.http)
  await instance.load({ code: await response.text(), apiVersion: entry.apiVersion })

  return { entry, instance, sources: bindSources(instance) }
}
