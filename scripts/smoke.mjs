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

    const row = page.locator('li', { hasText: 'Komikcast' }).first()
    await row.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    check('katalog repo menampilkan paket Komikcast', await row.isVisible())

    // 6. Pemasangan: unduh bundel, jalankan di Worker, catat sebagai terpasang.
    //    Tombol "Copot" cuma muncul kalau ketiganya berhasil.
    await row.getByRole('button', { name: 'Pasang' }).click()
    const uninstall = row.getByRole('button', { name: 'Copot' })
    await uninstall.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    check('Komikcast terpasang', await uninstall.isVisible())

    // 7. Verifikasi utama Fase 2: extension bertahan melewati restart app.
    await page.reload({ waitUntil: 'networkidle' })
    const afterReload = page.locator('li', { hasText: 'Komikcast' }).first()
    await afterReload
      .getByRole('button', { name: 'Copot' })
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => {})
    check(
      'masih terpasang setelah reload',
      await afterReload.getByRole('button', { name: 'Copot' }).isVisible(),
    )

    // 8. Inilah bukti runtime extension benar-benar hidup: nama "Komikcast" cuma
    //    bisa muncul di Browse kalau bundel-nya di-import di dalam Worker lewat
    //    blob URL, factory-nya jalan, dan describe() balik ke host lewat RPC.
    await page.goto(`${BASE}/browse`, { waitUntil: 'networkidle' })
    const komikcast = page.getByRole('link', { name: /Komikcast/ })
    await komikcast.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    check('Browse menampilkan sumber Komikcast dari extension', await komikcast.isVisible())
    check('label sumber menyebut bahasa dan jenis', await page.getByText('ID · manga').isVisible())

    // 9. Halaman sumber harus mendarat di keadaan pasti — daftar atau pesan
    //    error — bukan spinner abadi. Di mesin yang situsnya tak terjangkau
    //    yang muncul memang error, dan itu tetap perilaku yang benar.
    await komikcast.click()
    await page.waitForURL('**/browse/komikcast')
    check(
      'judul halaman memakai nama sumber',
      await page.getByRole('heading', { name: 'Komikcast' }).isVisible(),
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

    // 10. Fase 3 — katalog → library yang bertahan reload dan hilangnya jaringan.
    //     Seluruh blok ini butuh katalog yang benar-benar terisi. Di mesin yang
    //     situs sumbernya tidak terjangkau bagiannya dilewati dengan pesan, bukan
    //     dinyatakan lolos diam-diam.
    const grid = page.locator('[data-testid="entry-grid"]')
    if (!(await grid.isVisible())) {
      console.log('  … katalog kosong (sumber tak terjangkau), cek library dilewati')
    } else {
      /** Jendela ke SQLite yang sedang dipakai app; cuma ada di build dev. */
      const query = (sql, params = []) =>
        page.evaluate(([text, values]) => globalThis.__db.query(text, values), [sql, params])

      await grid.locator('a').first().click()
      await page.waitForURL('**/entry/manga/komikcast/**')

      // Id entri dibaca dari rutenya, bukan dari teks kartu: teks kartu ikut
      // memuat judul cadangan waktu cover gagal dimuat, dan `${sourceId}::${url}`
      // memang bentuk kunci yang dipakai tabelnya.
      const prefix = '/entry/manga/komikcast/'
      const id = `komikcast::${decodeURIComponent(new URL(page.url()).pathname.slice(prefix.length))}`

      // Browse menyimpan hasil katalognya, jadi barisnya sudah ada sebelum
      // getDetails() selesai — halaman detail tidak pernah mulai dari nol.
      const stored = await query('SELECT title FROM entry WHERE id = ?', [id])
      check('entri dari katalog tersimpan di SQLite', stored.length === 1)
      const title = stored[0]?.title ?? ''

      const markSeen = page.getByRole('button', { name: 'Tandai sudah dibaca' }).first()
      await markSeen.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {})
      check('daftar chapter tersinkron dari sumber', await markSeen.isVisible())

      await page.getByRole('button', { name: 'Tambah ke library' }).click()
      const inLibrary = page.getByRole('button', { name: 'Di library' })
      await inLibrary.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
      const favorited = await query('SELECT id FROM entry WHERE favorite = 1')
      check(
        'favorit tersimpan di kolom favorite, bukan cuma di layar',
        favorited.length === 1 && favorited[0]?.id === id,
      )

      // Sampai reader hadir di Fase 4, menandai chapter "sudah dibaca" adalah
      // satu-satunya peristiwa yang mengisi riwayat.
      await markSeen.click()
      await page
        .getByRole('button', { name: 'Tandai belum dibaca' })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 })
        .catch(() => {})
      check(
        'menandai chapter mengisi riwayat',
        (await query('SELECT item_id FROM history')).length === 1,
      )

      await page.goto(`${BASE}/library/manga`, { waitUntil: 'networkidle' })
      const libraryCards = page.locator('[data-testid="entry-grid"] a')
      await libraryCards
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
        .catch(() => {})
      check('judul favorit muncul di Library', (await libraryCards.count()) === 1)

      await page.getByRole('button', { name: 'Filter' }).click()
      await page.getByLabel('Nama kategori baru').fill('Uji')
      await page.getByRole('button', { name: 'Tambah kategori' }).click()
      const categoryTab = page.getByRole('tab', { name: /Uji/ })
      await categoryTab.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
      check('kategori baru muncul sebagai tab', await categoryTab.isVisible())

      // Yang diputus jaringan ke sumber (lewat proxy), bukan seluruh jaringan:
      // server dev masih harus bisa mengirim app-nya, persis seperti APK yang
      // sudah terpasang tapi kehilangan sinyal.
      await page.route('http://localhost:5181/**', (route) => route.abort())
      await page.reload({ waitUntil: 'networkidle' })
      await libraryCards
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
        .catch(() => {})
      check('library bertahan setelah reload tanpa jaringan', (await libraryCards.count()) === 1)
      check(
        'kategori bertahan setelah reload tanpa jaringan',
        await page.getByRole('tab', { name: /Uji/ }).isVisible(),
      )

      await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' })
      const historyRow = page.locator('li', { hasText: title }).first()
      await historyRow.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
      check('riwayat tetap tampil tanpa jaringan', await historyRow.isVisible())
      await page.unroute('http://localhost:5181/**')
    }

    // 11. Route tak dikenal jatuh ke halaman 404, bukan layar putih.
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
