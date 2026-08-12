/**
 * Smoke test Mirai.
 *
 * Sengaja bukan test framework: yang diuji di sini adalah app yang benar-benar
 * jalan di browser sungguhan, bukan komponen terisolasi. Jalankan `pnpm dev`
 * lebih dulu, lalu `node scripts/smoke.mjs`.
 *
 * Screenshot ditulis ke scripts/*.png (di-ignore git) supaya layout di dua
 * ekstrem lebar layar bisa diperiksa mata, bukan cuma diklaim lolos.
 */
import { chromium } from 'playwright'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:5180'

/** Lebar ekstrem yang harus tetap terpakai: HP kecil dan desktop lebar. */
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
]

let failures = 0

function check(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    console.error(`  ✗ ${label}`)
    failures += 1
  }
}

const browser = await chromium.launch()

try {
  for (const viewport of VIEWPORTS) {
    console.log(`\n[${viewport.name} ${viewport.width}x${viewport.height}]`)
    const page = await browser.newPage({ viewport })

    // 1. Boot: `/` harus mendarat di library anime, bukan layar kosong.
    await page.goto(BASE, { waitUntil: 'networkidle' })
    check('redirect / → /library/anime', new URL(page.url()).pathname === '/library/anime')
    check('judul halaman tampil', await page.getByRole('heading', { name: 'Anime' }).isVisible())

    // 2. Nav yang benar untuk lebar layar ini yang muncul — dan cuma satu.
    const bottomNav = page.locator('nav[aria-label="Navigasi utama"]').last()
    const sideRail = page.locator('aside[aria-label="Navigasi utama"]')
    const isMobile = viewport.width < 768
    check(
      isMobile ? 'BottomNav terlihat, SideRail tidak' : 'SideRail terlihat, BottomNav tidak',
      (await bottomNav.isVisible()) === isMobile && (await sideRail.isVisible()) === !isMobile,
    )

    // 3. Navigasi lintas halaman lewat nav yang sedang aktif.
    const nav = isMobile ? bottomNav : sideRail
    await nav.getByRole('link', { name: 'Manga' }).click()
    await page.waitForURL('**/library/manga')
    check('pindah ke library manga', await page.getByRole('heading', { name: 'Manga' }).isVisible())

    await nav.getByRole('link', { name: 'Browse' }).click()
    await page.waitForURL('**/browse')
    check(
      'halaman Browse menjelaskan kenapa kosong',
      await page.getByText('Belum ada sumber terpasang').isVisible(),
    )

    // 4. Tautan dari empty state harus benar-benar mendarat.
    await page.getByRole('link', { name: 'Buka Extension' }).click()
    await page.waitForURL('**/extensions')
    check('CTA empty state → /extensions', new URL(page.url()).pathname === '/extensions')

    // 5. Route tak dikenal jatuh ke halaman 404, bukan layar putih.
    await page.goto(`${BASE}/rute-yang-tidak-ada`, { waitUntil: 'networkidle' })
    check('404 tampil', await page.getByText('Halaman tidak ditemukan').isVisible())

    await page.goto(`${BASE}/library/anime`, { waitUntil: 'networkidle' })
    await page.screenshot({
      path: new URL(`./smoke-${viewport.name}.png`, import.meta.url).pathname,
      fullPage: false,
    })

    await page.close()
  }
} finally {
  await browser.close()
}

console.log(failures === 0 ? '\nSmoke OK' : `\nSmoke GAGAL: ${failures} cek tidak lolos`)
process.exit(failures === 0 ? 0 : 1)
