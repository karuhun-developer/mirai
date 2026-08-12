/**
 * Uji asap terhadap situs sungguhan.
 *
 * Bukan bagian dari `pnpm build` dan tidak pernah dijalankan CI: hasilnya
 * bergantung pada situs pihak ketiga yang bisa mati, berpindah domain, atau
 * diblokir jaringan tempat perintah ini dijalankan. Gunanya untuk memastikan
 * bundel yang benar-benar dihasilkan esbuild — lengkap dengan linkedom di
 * dalamnya — masih cocok dengan markup situs hari ini.
 *
 *   node scripts/smoke.mjs                 # semua paket
 *   node scripts/smoke.mjs mangabat        # satu paket
 *
 * `MIRAI_SMOKE_RESOLVE=host=ip,host2=ip2` memaksa alamat IP untuk host
 * tertentu, untuk jaringan yang memblokir sumber lewat DNS.
 */

import { lookup } from 'node:dns'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Agent, setGlobalDispatcher } from 'undici'

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

// --- Pemaksaan DNS -----------------------------------------------------------

const overrides = new Map(
  (process.env['MIRAI_SMOKE_RESOLVE'] ?? '')
    .split(',')
    .filter(Boolean)
    .map((pair) => pair.split('=')),
)

if (overrides.size > 0) {
  setGlobalDispatcher(
    new Agent({
      connect: {
        lookup(hostname, options, callback) {
          const forced = overrides.get(hostname)
          if (!forced) return lookup(hostname, options, callback)
          // undici meminta bentuk larik saat `all`, bentuk tunggal kalau tidak.
          if (options.all) return callback(null, [{ address: forced, family: 4 }])
          return callback(null, forced, 4)
        },
      },
    }),
  )
}

// --- Konteks tiruan ----------------------------------------------------------

/** Rate limit kasar; cukup untuk tidak memicu proteksi situs saat uji. */
let lastRequest = 0
async function throttle() {
  const gap = Date.now() - lastRequest
  if (gap < 400) await new Promise((r) => setTimeout(r, 400 - gap))
  lastRequest = Date.now()
}

/**
 * Salinan ringkas `isCloudflareChallenge()` dari
 * `packages/extension-runtime/src/http/cloudflare.ts`. Skrip ini sengaja berdiri
 * sendiri — dijalankan dengan `node` polos tanpa build — jadi sepuluh baris ini
 * ditiru alih-alih menyeret seluruh workspace ke dalamnya.
 */
function isCloudflareChallenge(res) {
  if (![403, 429, 503].includes(res.status)) return false
  if ((res.headers['cf-mitigated'] ?? '').includes('challenge')) return true
  const fromCloudflare =
    (res.headers['server'] ?? '').includes('cloudflare') || res.headers['cf-ray'] !== undefined
  return (
    fromCloudflare &&
    ['__cf_chl', 'challenge-platform', 'cf-browser-verification', 'Just a moment'].some((m) =>
      res.body.includes(m),
    )
  )
}

class ChallengeError extends Error {
  constructor(url) {
    super(`Cloudflare menahan ${url} dengan verifikasi "verify you are human"`)
    this.isChallenge = true
  }
}

const http = {
  async request(req) {
    await throttle()
    const res = await fetch(req.url, {
      method: req.method ?? 'GET',
      headers: req.headers ?? {},
      body: req.body,
      redirect: 'follow',
    })
    const body = await res.text()
    const result = {
      url: res.url,
      status: res.status,
      ok: res.ok,
      headers: Object.fromEntries(res.headers),
      body,
    }
    // Tantangan dihentikan di sini supaya yang terbaca di log bukan "parser
    // tidak menemukan selector" untuk halaman yang memang bukan halaman sumber.
    if (isCloudflareChallenge(result)) throw new ChallengeError(new URL(req.url).origin)
    return result
  },
  get(url, headers) {
    return http.request({ url, method: 'GET', headers })
  },
  post(url, body, headers) {
    return http.request({ url, method: 'POST', body, headers })
  },
  async getJson(url, headers) {
    const res = await http.get(url, headers)
    return JSON.parse(res.body)
  },
}

const preferences = {
  getString: (_key, fallback) => fallback,
  getBoolean: (_key, fallback) => fallback,
  getStringList: (_key, fallback) => [...fallback],
}

// --- Alur uji ----------------------------------------------------------------

const trim = (value, max = 70) => (value.length > max ? `${value.slice(0, max)}…` : value)

async function smokeManga(source) {
  const popular = await source.getPopular(1)
  console.log(`  populer   : ${popular.entries.length} entri, next=${popular.hasNextPage}`)
  const first = popular.entries[0]
  if (!first) throw new Error('katalog kosong')
  console.log(`  entri #1  : ${trim(first.title)} → ${first.url}`)

  const details = await source.getDetails(first)
  console.log(`  detail    : status=${details.status} genre=${(details.genre ?? []).length}`)

  const chapters = await source.getChapterList(details)
  console.log(`  chapter   : ${chapters.length} — terbaru "${trim(chapters[0]?.name ?? '-')}"`)

  const last = chapters.at(-1)
  if (!last) throw new Error('daftar chapter kosong')
  const pages = await source.getPageList(last)
  console.log(`  halaman   : ${pages.length} — ${trim(pages[0]?.imageUrl ?? '-')}`)
}

async function smokeAnime(source) {
  const popular = await source.getPopular(1)
  console.log(`  populer   : ${popular.entries.length} entri, next=${popular.hasNextPage}`)
  const first = popular.entries[0]
  if (!first) throw new Error('katalog kosong')
  console.log(`  entri #1  : ${trim(first.title)} → ${first.url}`)

  const details = await source.getDetails(first)
  console.log(`  detail    : status=${details.status} genre=${(details.genre ?? []).length}`)

  const episodes = await source.getEpisodeList(details)
  console.log(`  episode   : ${episodes.length} — pertama "${trim(episodes[0]?.name ?? '-')}"`)

  const target = episodes[0]
  if (!target) throw new Error('daftar episode kosong')
  const videos = await source.getVideoList(target)
  console.log(`  video     : ${videos.length}`)
  for (const video of videos) {
    console.log(`    [${video.type}] ${video.quality} → ${trim(video.url)}`)
  }
}

// --- Runner ------------------------------------------------------------------

const index = JSON.parse(await readFile(join(distDir, 'index.min.json'), 'utf8'))
const wanted = process.argv.slice(2)
const targets = wanted.length > 0 ? index.filter((e) => wanted.includes(e.pkg)) : index

let failed = 0
let blocked = 0
for (const entry of targets) {
  console.log(`\n=== ${entry.name} (${entry.pkg}) ===`)
  try {
    const module = await import(pathToFileURL(join(distDir, entry.file)).href)
    const sources = module.default({ apiVersion: entry.apiVersion, http, preferences })
    for (const source of sources) {
      await (source.kind === 'anime' ? smokeAnime(source) : smokeManga(source))
    }
  } catch (error) {
    const cause = error instanceof Error && error.cause ? ` (${error.cause})` : ''
    const message = error instanceof Error ? error.message : String(error)
    // Tantangan Cloudflare bukan extension yang rusak: kodenya bisa saja benar
    // seluruhnya dan tetap tertahan. Menghitungnya sebagai kegagalan build
    // membuat orang mengutak-atik parser yang tidak salah apa-apa.
    if (error?.isChallenge) {
      blocked += 1
      console.log(`  TERTAHAN  : ${message}`)
      console.log('              Diselesaikan pengguna di WebView APK, bukan oleh skrip ini.')
    } else {
      failed += 1
      console.log(`  GAGAL     : ${message}${cause}`)
    }
  }
}

const passed = targets.length - failed - blocked
console.log(
  `\n${passed}/${targets.length} paket lolos` +
    (blocked > 0 ? `, ${blocked} tertahan verifikasi Cloudflare` : ''),
)
process.exitCode = failed > 0 ? 1 : 0
