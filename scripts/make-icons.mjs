/**
 * Membuat ikon dan splash Android dari satu sumber: `apps/app/public/favicon.svg`.
 *
 * Kenapa Playwright dan bukan ImageMagick/sharp: peramban Chromium-nya sudah
 * ada di repo ini untuk smoke test, sedangkan menambah `sharp` berarti 292
 * paket dan biner native cuma untuk sesuatu yang dijalankan sekali-sekali.
 * Yang dirender di sini juga persis mesin yang merender ikon aplikasi webnya,
 * jadi tidak ada dua penafsiran SVG yang berbeda.
 *
 * Semua ukurannya mengikuti apa yang sudah dibuat template Capacitor — berkas
 * hasilnya menimpa yang itu, bukan menambah nama baru, supaya manifest dan tema
 * bawaan tidak perlu disentuh.
 *
 * Pakai: `node scripts/make-icons.mjs` (lalu commit hasilnya).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RES = join(ROOT, 'apps/app/android/app/src/main/res')

/** Warna dan bentuk mereknya satu-satunya sumber: favicon aplikasi web. */
const BG = '#0b0f13'
const MARK_COLOR = '#4fd1c5'
const MARK = 'M7 23V9h3.2l5.8 8.2L21.8 9H25v14h-3.1v-8.6L16.9 22h-1.8L10.1 14.4V23H7z'

/** Kepadatan layar Android beserta pengalinya terhadap mdpi. */
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
]

/**
 * Satu halaman SVG berukuran piksel pasti.
 *
 * `shape-rendering` dibiarkan bawaan supaya tepinya tetap halus; yang penting
 * `margin: 0` — tanpa itu Chromium menyisakan delapan piksel putih di tiap sisi.
 */
function svgPage(size, body) {
  return `<!doctype html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"
     viewBox="0 0 ${size.width} ${size.height}">${body}</svg>
</body></html>`
}

/**
 * Tanda "M" di tengah kanvas, lebarnya `ratio` dari sisi terpendek.
 *
 * Path aslinya digambar di kotak 32×32, jadi penempatannya cukup satu
 * `translate` + `scale` — bukan menghitung ulang koordinatnya.
 */
function mark(width, height, ratio) {
  const scale = (Math.min(width, height) * ratio) / 32
  const offsetX = (width - 32 * scale) / 2
  const offsetY = (height - 32 * scale) / 2
  return `<g transform="translate(${offsetX} ${offsetY}) scale(${scale})">
    <path d="${MARK}" fill="${MARK_COLOR}" />
  </g>`
}

async function shoot(page, path, size, body, transparent = false) {
  await page.setViewportSize(size)
  await page.setContent(svgPage(size, body))
  const png = await page.screenshot({ omitBackground: transparent })

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, png)
}

const browser = await chromium.launch()
const page = await browser.newPage()

for (const [density, multiplier] of DENSITIES) {
  const launcher = 48 * multiplier
  // Ikon adaptif digambar di kanvas 108dp, tapi peluncur memotongnya jadi
  // lingkaran/kotak-bulat 72dp di tengah. Karena itu tandanya cuma boleh
  // memakai sepertiga kanvas — lebih besar sedikit saja, ujung "M"-nya hilang.
  const adaptive = 108 * multiplier

  await shoot(
    page,
    join(RES, `mipmap-${density}/ic_launcher.png`),
    { width: launcher, height: launcher },
    `<rect width="${launcher}" height="${launcher}" rx="${launcher * 0.22}" fill="${BG}" />
     ${mark(launcher, launcher, 0.72)}`,
  )

  await shoot(
    page,
    join(RES, `mipmap-${density}/ic_launcher_round.png`),
    { width: launcher, height: launcher },
    `<circle cx="${launcher / 2}" cy="${launcher / 2}" r="${launcher / 2}" fill="${BG}" />
     ${mark(launcher, launcher, 0.64)}`,
    true,
  )

  await shoot(
    page,
    join(RES, `mipmap-${density}/ic_launcher_foreground.png`),
    { width: adaptive, height: adaptive },
    mark(adaptive, adaptive, 0.4),
    true,
  )
}

/** Ukuran splash bawaan template Capacitor; `drawable/` polos jadi cadangannya. */
const SPLASHES = [
  ['drawable', 480, 320],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
]

for (const [dir, width, height] of SPLASHES) {
  await shoot(
    page,
    join(RES, `${dir}/splash.png`),
    { width, height },
    `<rect width="${width}" height="${height}" fill="${BG}" />${mark(width, height, 0.28)}`,
  )
}

await browser.close()
console.log(`✔ ${DENSITIES.length * 3 + SPLASHES.length} berkas ikon & splash ditulis ke ${RES}`)
