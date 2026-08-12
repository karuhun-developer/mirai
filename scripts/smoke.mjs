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
    // newPage() membuat context sendiri, jadi tiap viewport mulai dari
    // localStorage kosong — pemasangan extension di bawah benar-benar diuji
    // dari nol, bukan mewarisi hasil putaran sebelumnya.
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

    // 4. Mirai tidak membawa sumber bawaan. Browse pada pemasangan baru wajib
    //    kosong dan menunjuk ke halaman Extension — bukan diam-diam memuat
    //    semua isi repo seperti sebelum Fase 2.
    await nav.getByRole('link', { name: 'Browse' }).click()
    await page.waitForURL('**/browse')
    const toExtensions = page.getByRole('link', { name: 'Buka Extension' })
    await toExtensions.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    check('Browse kosong sebelum ada extension terpasang', await toExtensions.isVisible())

    // 5. Repo pengembangan sudah terdaftar, dan isinya terbaca.
    await toExtensions.click()
    await page.waitForURL('**/extensions')
    check('repo dev terdaftar', await page.getByText('Repo pengembangan').isVisible())

    const row = page.locator('li', { hasText: 'MangaDex' }).first()
    await row.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    check('katalog repo menampilkan paket MangaDex', await row.isVisible())

    // 6. Pemasangan: unduh bundel, jalankan di Worker, catat sebagai terpasang.
    //    Tombol "Copot" cuma muncul kalau ketiganya berhasil.
    await row.getByRole('button', { name: 'Pasang' }).click()
    const uninstall = row.getByRole('button', { name: 'Copot' })
    await uninstall.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    check('MangaDex terpasang', await uninstall.isVisible())

    // 7. Verifikasi utama Fase 2: extension bertahan melewati restart app.
    await page.reload({ waitUntil: 'networkidle' })
    const afterReload = page.locator('li', { hasText: 'MangaDex' }).first()
    await afterReload
      .getByRole('button', { name: 'Copot' })
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => {})
    check(
      'masih terpasang setelah reload',
      await afterReload.getByRole('button', { name: 'Copot' }).isVisible(),
    )

    // 8. Inilah bukti runtime extension benar-benar hidup: nama "MangaDex" cuma
    //    bisa muncul di Browse kalau bundel-nya di-import di dalam Worker lewat
    //    blob URL, factory-nya jalan, dan describe() balik ke host lewat RPC.
    await page.goto(`${BASE}/browse`, { waitUntil: 'networkidle' })
    const mangadex = page.getByRole('link', { name: /MangaDex/ })
    await mangadex.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    check('Browse menampilkan sumber MangaDex dari extension', await mangadex.isVisible())
    check('label sumber menyebut bahasa dan jenis', await page.getByText('ALL · manga').isVisible())

    // 9. Halaman sumber harus mendarat di keadaan pasti — daftar atau pesan
    //    error — bukan spinner abadi. Di mesin tanpa akses ke MangaDex yang
    //    muncul memang error, dan itu tetap perilaku yang benar.
    await mangadex.click()
    await page.waitForURL('**/browse/mangadex')
    check(
      'judul halaman memakai nama sumber',
      await page.getByRole('heading', { name: 'MangaDex' }).isVisible(),
    )
    check('kotak pencarian tersedia', await page.getByLabel('Cari judul').isVisible())

    const settled = page
      .locator('[data-testid="entry-grid"], .text-destructive, :text("Tidak ada hasil.")')
      .first()
    await settled.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    check(
      'permintaan populer selesai (hasil atau error), bukan menggantung',
      await settled.isVisible(),
    )

    // 10. Route tak dikenal jatuh ke halaman 404, bukan layar putih.
    await page.goto(`${BASE}/rute-yang-tidak-ada`, { waitUntil: 'networkidle' })
    check('404 tampil', await page.getByText('Halaman tidak ditemukan').isVisible())

    await page.goto(`${BASE}/extensions`, { waitUntil: 'networkidle' })
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
