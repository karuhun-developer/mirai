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
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

/**
 * Menunggu sebuah keadaan jadi benar.
 *
 * Dipakai untuk cek yang menyentuh SQLite: tulisannya asinkron dan terjadi
 * setelah UI berubah, jadi membacanya sekali langsung setelah penekanan tombol
 * kadang mengenai keadaan sebelum tulisan itu mendarat.
 */
async function waitUntil(condition, timeout = 10_000) {
  const until = Date.now() + timeout
  for (;;) {
    if (await condition()) return true
    if (Date.now() > until) return false
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
}

/**
 * Menggeser posisi tonton lewat bilah kendali.
 *
 * Bukan `fill()` langsung: kendali pemutar menyembunyikan diri tiga detik
 * setelah video jalan, dan `fill()` yang menunggu elemen tersembunyi akan diam
 * sampai kendalinya muncul lagi — biasanya baru waktu episodenya sudah habis.
 * Satu ketukan di videonya memunculkan kendali lebih dulu, persis seperti yang
 * dilakukan orang.
 */
async function seekPlayer(page, seconds) {
  const seek = page.locator('[data-testid="player-seek"]')
  if (!(await seek.isVisible())) await page.locator('[data-testid="player-video"]').click()
  await seek.waitFor({ state: 'visible', timeout: 15_000 })
  await seek.fill(String(seconds))
}

/**
 * Berkas video kecil untuk menguji pemutar.
 *
 * Chromium bawaan Playwright tidak punya dekoder H.264, dan situs anime tidak
 * terjangkau dari mesin ini — dua alasan yang membuat episode sungguhan tidak
 * bisa dipakai. VP9 selalu ada di Chromium mana pun, jadi satu klip 30 detik
 * dibikin sendiri dengan ffmpeg dan disodorkan sebagai data URL.
 *
 * `-g 5` memaksa keyframe tiap detik supaya melompat ke detik tertentu benar
 * mendarat di situ, bukan di keyframe terdekat beberapa detik sebelumnya.
 */
function makeFixtureVideo() {
  try {
    const path = join(mkdtempSync(join(tmpdir(), 'mirai-smoke-')), 'fixture.webm')
    execFileSync(
      'ffmpeg',
      // prettier-ignore
      [
        '-v', 'error', '-y',
        '-f', 'lavfi', '-i', 'color=c=darkblue:size=160x120:rate=5:duration=30',
        '-c:v', 'libvpx-vp9', '-b:v', '20k', '-g', '5',
        '-deadline', 'realtime', '-cpu-used', '8', '-an',
        path,
      ],
      { stdio: 'pipe' },
    )
    return `data:video/webm;base64,${readFileSync(path).toString('base64')}`
  } catch {
    // ffmpeg tidak terpasang: seluruh blok pemutar dilewati dengan pesan, bukan
    // dinyatakan lolos diam-diam.
    return null
  }
}

const fixtureVideo = makeFixtureVideo()

/**
 * Satu episode HLS tiruan, seluruhnya di dalam satu alamat.
 *
 * Segmennya fMP4 berisi VP9, bukan MPEG-TS yang lazim di situs anime: Chromium
 * bawaan Playwright tidak punya dekoder H.264, dan tanpa itu TS tidak akan
 * pernah sampai ke layar. Sisa rantainya tetap yang sungguhan — playlist
 * dibedah, `#EXT-X-MAP` beserta tiap segmennya diunduh satu per satu, playlist
 * lokal ditulis, lalu hls.js memutarnya lewat loader yang membaca berkas.
 *
 * Playlist dan isinya jadi data URL supaya tidak butuh server berkas: alamat
 * data lolos begitu saja dari resolver media (lihat `isLocalUrl`), jadi
 * pengambilannya tidak melewati proxy — itu juga yang membuat blok ini tetap
 * jujur waktu jaringannya diputus belakangan.
 */
function makeFixtureHls() {
  try {
    const dir = mkdtempSync(join(tmpdir(), 'mirai-smoke-hls-'))
    execFileSync(
      'ffmpeg',
      // prettier-ignore
      [
        '-v', 'error', '-y',
        '-f', 'lavfi', '-i', 'color=c=darkgreen:size=160x120:rate=5:duration=30',
        '-c:v', 'libvpx-vp9', '-b:v', '20k', '-g', '5',
        '-deadline', 'realtime', '-cpu-used', '8', '-an',
        '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
        '-hls_segment_type', 'fmp4', '-hls_fmp4_init_filename', 'init.mp4',
        '-hls_segment_filename', join(dir, 'seg-%d.m4s'),
        join(dir, 'index.m3u8'),
      ],
      { stdio: 'pipe' },
    )

    const dataUrl = (name, mime) =>
      `data:${mime};base64,${readFileSync(join(dir, name)).toString('base64')}`

    const playlist = readFileSync(join(dir, 'index.m3u8'), 'utf8')
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (trimmed === '') return line
        if (/^#EXT-X-MAP/i.test(trimmed)) {
          return line.replace(/URI="([^"]+)"/, (_, name) => `URI="${dataUrl(name, 'video/mp4')}"`)
        }
        return trimmed.startsWith('#') ? line : dataUrl(trimmed, 'video/iso.segment')
      })
      .join('\n')

    return `data:application/vnd.apple.mpegurl;base64,${Buffer.from(playlist).toString('base64')}`
  } catch {
    return null
  }
}

const fixtureHls = makeFixtureHls()

/**
 * Tiga halaman manga tiruan: PNG 8×8 tiga warna sebagai data URL.
 *
 * Situs sumber manga tidak terjangkau dari mesin ini, jadi halamannya disuapkan
 * lewat `window.__downloads`. Yang diuji tetap jalur sungguhannya — berkasnya
 * benar-benar ditulis ke OPFS, dibaca lagi sebagai `blob:`, dan ditampilkan
 * reader. Warnanya dibikin berbeda supaya tiap halaman punya alamat sendiri;
 * `WebtoonView` memakai URL halaman sebagai `key`, dan tiga URL identik akan
 * saling menimpa.
 */
const FIXTURE_PAGES = [
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR42mO4Y2ODFTEMLQkAXrdVAaRBiusAAAAASUVORK5CYII=',
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR42mOw2RKFFTEMLQkANShSgeWfpzMAAAAASUVORK5CYII=',
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR42mNwy7uDFTEMLQkA7YJkAa1Ps+4AAAAASUVORK5CYII=',
].map((data, index) => ({ index, imageUrl: `data:image/png;base64,${data}` }))

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

      // 10b. Fase 4 — baca satu chapter, keluar di tengah, masuk lagi.
      //      Chapter kedua yang dipakai: yang pertama sudah ditandai selesai di
      //      atas, dan chapter selesai sengaja mulai dari halaman satu lagi.
      const chapters = page.locator('[data-testid="item-open"]')
      await chapters.nth(1).click()
      await page.waitForURL('**/read/**')

      const reader = page.locator('[data-testid="reader"]')
      const firstImage = reader.locator('img').first()
      await firstImage.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {})

      if (!(await firstImage.isVisible())) {
        console.log('  … halaman chapter tidak bisa diambil dari sumber, cek reader dilewati')
        await page.goBack()
      } else {
        check('chapter terbuka dan halaman pertamanya tampil', true)
        const itemId = decodeURIComponent(new URL(page.url()).pathname.slice('/read/'.length))

        // Mode bawaan `webtoon` menentukan halaman lewat gulir — tidak
        // deterministik di headless. Ditukar ke mode halaman lewat panel
        // setelannya sendiri, sekalian menguji panel itu.
        await page.waitForTimeout(2800) // menu menyembunyikan dirinya
        await page.keyboard.press('m')
        const settingsButton = page.getByRole('button', { name: 'Setelan reader' })
        await settingsButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
        check('menu reader bisa dipanggil lewat papan ketik', await settingsButton.isVisible())

        await settingsButton.click()
        await page.getByRole('button', { name: 'Kiri → kanan' }).click()
        await page.getByRole('button', { name: 'Tutup setelan' }).click()

        await page.keyboard.press('ArrowRight')
        await page.keyboard.press('ArrowRight')
        const advanced = await waitUntil(async () => {
          const rows = await query('SELECT last_position FROM item WHERE id = ?', [itemId])
          return rows[0]?.last_position === 2
        })
        check('maju dua halaman tersimpan sebagai posisi baca', advanced)

        // Keluar di tengah chapter — inti verifikasi fase ini.
        await page.keyboard.press('Escape')
        await page.waitForURL('**/entry/manga/komikcast/**')
        await chapters.nth(1).click()
        await page.waitForURL('**/read/**')

        // Menu (dan penghitungnya) tampil sejak detik pertama, jadi menunggu
        // penghitung terlihat saja akan membaca "0 / 0" — yang ditunggu adalah
        // daftar halamannya sampai.
        const counter = reader.locator('p.tabular-nums').first()
        await waitUntil(
          async () => !/^0 \/ 0/.test(((await counter.textContent()) ?? '').trim()),
          30_000,
        )
        const resumed = (await counter.textContent()) ?? ''
        check(`masuk lagi mendarat di halaman yang sama (${resumed.trim()})`, /^3 \//.test(resumed))

        // Sampai halaman terakhir: chapternya harus bertanda selesai tanpa
        // ditandai manual.
        const total = Number(resumed.split('/')[1]?.trim() ?? '0')
        for (let at = 3; at < Math.min(total, 80); at += 1) {
          await page.keyboard.press('ArrowRight')
        }
        const finished = await waitUntil(async () => {
          const rows = await query('SELECT seen FROM item WHERE id = ?', [itemId])
          return rows[0]?.seen === 1
        })
        check('halaman terakhir menandai chapter sudah dibaca', finished)

        await page.keyboard.press('Escape')
        await page.waitForURL('**/entry/manga/komikcast/**')
        check(
          'dua chapter bertanda sudah dibaca di halaman detail',
          (await page.getByRole('button', { name: 'Tandai belum dibaca' }).count()) === 2,
        )
      }

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

    // 11. Fase 5 — menonton satu episode.
    //
    //     Situs anime tidak terjangkau dari mesin ini, jadi anime beserta
    //     episodenya dipasang langsung ke SQLite dan daftar videonya diganti
    //     berkas tiruan lewat `window.__player`. Yang diuji tetap rantai
    //     sungguhannya: konteks episode dari database → pemilihan kualitas →
    //     elemen `<video>` di browser sungguhan → progres, lanjut, dan tanda
    //     selesai yang mendarat di tabel.
    if (!fixtureVideo) {
      console.log('  … ffmpeg tidak ada, cek pemutar dilewati')
    } else {
      await page.goto(`${BASE}/extensions`, { waitUntil: 'networkidle' })
      const otakudesu = page.locator('li', { hasText: 'Otakudesu' }).first()
      await otakudesu.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
      await otakudesu.getByRole('button', { name: 'Pasang' }).click()
      const otakudesuInstalled = otakudesu.getByRole('button', { name: 'Copot' })
      await otakudesuInstalled.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
      check('Otakudesu terpasang', await otakudesuInstalled.isVisible())

      const query = (sql, params = []) =>
        page.evaluate(([text, values]) => globalThis.__db.query(text, values), [sql, params])

      const entryId = await page.evaluate(async (now) => {
        const url = 'https://otakudesu.blog/anime/uji-smoke/'
        const id = `otakudesu::${url}`
        await globalThis.__db.run(
          `INSERT OR REPLACE INTO entry
             (id, kind, source_id, url, title, favorite, added_at, items_at, updated_at)
           VALUES (?, 'anime', 'otakudesu', ?, 'Anime Uji Smoke', 1, ?, ?, ?)`,
          [id, url, now, now, now],
        )
        for (const number of [1, 2, 3]) {
          const episode = `https://otakudesu.blog/episode/uji-smoke-${number}/`
          await globalThis.__db.run(
            `INSERT OR REPLACE INTO item
               (id, entry_id, url, name, number, sort_index, added_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [`${id}::${episode}`, id, episode, `Episode ${number}`, number, number, now, now],
          )
        }
        // Tulisan mentah tidak melewati repository, jadi snapshot-nya tidak
        // dijadwalkan sendiri — tanpa flush, baris ini lenyap di muat ulang.
        await globalThis.__db.flush()
        return id
      }, Date.now())

      // Masuk lewat jalan yang dipakai orang: library → detail → baris episode.
      await page.goto(`${BASE}/library/anime`, { waitUntil: 'networkidle' })
      const animeCard = page.locator('[data-testid="entry-grid"] a').first()
      await animeCard.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
      check('anime tersimpan muncul di Library', await animeCard.isVisible())

      await animeCard.click()
      await page.waitForURL('**/entry/anime/otakudesu/**')
      const episodes = page.locator('[data-testid="item-open"]')
      await episodes
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => {})
      check('daftar episode tampil walau sumbernya tak terjangkau', (await episodes.count()) === 3)

      // Daftarnya menurun (terbaru dulu), jadi episode 1 ada di baris terakhir —
      // dan cuma dari situ "episode berikutnya" punya arti.
      const firstEpisode = episodes.last()
      await firstEpisode.click()
      await page.waitForURL('**/watch/**')
      const itemId = decodeURIComponent(new URL(page.url()).pathname.slice('/watch/'.length))

      // Jembatan pemutar baru ada setelah potongan halamannya termuat.
      await page.waitForFunction(() => globalThis.__player !== undefined, null, { timeout: 20_000 })
      await page.evaluate((src) => {
        globalThis.__player.fixture([
          { url: src, quality: '480p', type: 'mp4', subtitles: [] },
          { url: src, quality: '720p', type: 'mp4', subtitles: [] },
        ])
      }, fixtureVideo)
      await page.getByRole('button', { name: 'Coba lagi' }).click()

      const video = page.locator('[data-testid="player-video"]')
      await video.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
      check('elemen video terpasang', await video.isVisible())

      const timeLabel = page.locator('[data-testid="player-time"]')
      const readTime = async () => ((await timeLabel.textContent()) ?? '').trim()
      const started = await waitUntil(async () => /\/ 0:30$/.test(await readTime()), 20_000)
      check('durasi episode terbaca dari berkasnya (0:30)', started)

      // Video berjalan sendiri: elemen tanpa jalur audio boleh diputar tanpa
      // gestur, dan halaman ini memang sudah dapat gestur dari tombol di atas.
      const running = await waitUntil(
        async () => (await video.evaluate((el) => el.currentTime)) > 0,
        15_000,
      )
      check('video benar-benar berjalan, bukan diam di detik nol', running)

      // Lompat ke detik 10, lalu pastikan angkanya mendarat di tabel.
      await seekPlayer(page, 10)
      const saved = await waitUntil(async () => {
        const rows = await query('SELECT last_position, total_position FROM item WHERE id = ?', [
          itemId,
        ])
        return rows[0]?.last_position >= 10 && rows[0]?.total_position === 30
      })
      check('posisi tonton dan durasi tersimpan dalam detik', saved)
      check(
        'menonton mengisi riwayat anime',
        await waitUntil(async () => {
          const rows = await query('SELECT item_id FROM history WHERE entry_id = ?', [entryId])
          return rows.length === 1
        }),
      )

      // Keluar di tengah episode, lalu masuk lagi — inti verifikasi fase ini.
      await page.keyboard.press('Escape')
      await page.waitForURL('**/entry/anime/otakudesu/**')
      await firstEpisode.click()
      await page.waitForURL('**/watch/**')
      const resumed = await waitUntil(
        async () => (await video.evaluate((el) => el.currentTime)) >= 10,
        20_000,
      )
      check('masuk lagi melanjutkan dari detik yang sama', resumed)

      // Ganti kualitas: sumbernya berganti, posisinya tidak boleh ikut hilang.
      // Dijeda dulu supaya kendalinya menetap — selama video berjalan bilahnya
      // menyembunyikan diri sendiri setelah tiga detik.
      await page.keyboard.press('k')
      await page.locator('[data-testid="player-settings-open"]').click()
      await page.locator('[data-testid="player-video-1"]').click()
      await page.locator('[data-testid="player-settings-close"]').click()
      const kept = await waitUntil(
        async () => (await video.evaluate((el) => el.currentTime)) >= 10,
        20_000,
      )
      check('berganti kualitas tidak mengulang dari awal', kept)
      check(
        'kualitas yang dipilih tampil di kendali',
        (await page.locator('[data-testid="player-quality"]').textContent())?.includes('720p'),
      )

      // Lewat ambang 90%: episodenya harus bertanda selesai tanpa ditandai
      // manual, lalu lanjut sendiri ke episode berikutnya.
      await seekPlayer(page, 28)
      const watched = await waitUntil(async () => {
        const rows = await query('SELECT seen FROM item WHERE id = ?', [itemId])
        return rows[0]?.seen === 1
      })
      check('lewat 90% durasi menandai episode sudah ditonton', watched)

      const advanced = await waitUntil(async () => page.url().includes('uji-smoke-2'), 20_000)
      check('episode habis lanjut sendiri ke episode berikutnya', advanced)

      await page.keyboard.press('Escape')
      await page.waitForURL('**/entry/anime/otakudesu/**')
    }

    // 12. Fase 6 — mengunduh chapter, lalu membacanya tanpa jaringan.
    //
    //     Judul dan chapternya dipasang langsung ke SQLite dengan alasan yang
    //     sama seperti blok anime di atas, dan daftar halamannya diganti tiruan
    //     lewat `window.__downloads`. Yang tidak ditiru justru inti fasenya:
    //     berkasnya benar-benar ditulis ke OPFS, tanda "terunduh" mendarat di
    //     tabel, dan reader membacanya kembali waktu jalur ke sumber diputus.
    const dbQuery = (sql, params = []) =>
      page.evaluate(([text, values]) => globalThis.__db.query(text, values), [sql, params])

    const mangaId = await page.evaluate(async (now) => {
      const url = 'https://komikcast.li/komik/unduh-uji-smoke/'
      const id = `komikcast::${url}`
      await globalThis.__db.run(
        `INSERT OR REPLACE INTO entry
           (id, kind, source_id, url, title, favorite, added_at, items_at, updated_at)
         VALUES (?, 'manga', 'komikcast', ?, 'Manga Unduh Uji Smoke', 1, ?, ?, ?)`,
        [id, url, now, now, now],
      )
      for (const number of [1, 2, 3, 4]) {
        const chapter = `https://komikcast.li/chapter/unduh-uji-smoke-${number}/`
        await globalThis.__db.run(
          `INSERT OR REPLACE INTO item
             (id, entry_id, url, name, number, sort_index, added_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [`${id}::${chapter}`, id, chapter, `Chapter ${number}`, number, number, now, now],
        )
      }
      // `items_at` yang baru menahan sinkronisasi otomatis: halaman detail cuma
      // menyegarkan daftar yang sudah basi, dan URL di atas tidak ada isinya.
      await globalThis.__db.flush()
      return id
    }, Date.now())

    await page.goto(`${BASE}/library/manga`, { waitUntil: 'networkidle' })
    const mangaCard = page.locator('[data-testid="entry-grid"] a[href*="unduh-uji-smoke"]').first()
    await mangaCard.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    check('manga tersimpan muncul di Library', await mangaCard.isVisible())

    await mangaCard.click()
    await page.waitForURL('**/entry/manga/komikcast/**')
    const downloadButtons = page.locator('[data-testid="item-download"]')
    await downloadButtons
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => {})
    check('tiap chapter punya tombol unduh', (await downloadButtons.count()) === 4)

    // Jembatan unduhan dipasang saat modul antreannya termuat — yaitu waktu
    // shell aplikasi menyalakan antrean, bukan waktu halaman ini dibuka.
    await page.waitForFunction(() => globalThis.__downloads !== undefined, null, {
      timeout: 20_000,
    })
    await page.evaluate((pages) => globalThis.__downloads.fixture(pages), FIXTURE_PAGES)

    // Daftarnya menurun, jadi tiga baris teratas adalah chapter 4, 3, dan 2 —
    // chapter 1 di baris terakhir sengaja ditinggalkan tanpa unduhan.
    for (const at of [0, 1, 2]) await downloadButtons.nth(at).click()

    const downloaded = await waitUntil(async () => {
      const rows = await dbQuery(
        "SELECT COUNT(*) AS n FROM download WHERE entry_id = ? AND state = 'done'",
        [mangaId],
      )
      return rows[0]?.n === 3
    }, 30_000)
    check('tiga chapter selesai diunduh', downloaded)
    check(
      'chapter terunduh bertanda di tabel item',
      (await dbQuery('SELECT id FROM item WHERE entry_id = ? AND downloaded = 1', [mangaId]))
        .length === 3,
    )

    await page.goto(`${BASE}/downloads`, { waitUntil: 'networkidle' })
    const doneRows = page.locator('li', { hasText: 'Manga Unduh Uji Smoke' })
    await doneRows
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {})
    check('halaman Unduhan menampilkan ketiganya', (await doneRows.count()) === 3)

    // Inti verifikasi fase ini: jalur ke sumber diputus, lalu ketiga chapter
    // harus tetap terbaca utuh dari berkas di perangkat. Reload lebih dulu
    // supaya yang dibaca benar-benar berkas tersimpan, bukan sisa di memori.
    await page.route('http://localhost:5181/**', (route) => route.abort())
    await page.reload({ waitUntil: 'networkidle' })

    await page.goto(`${BASE}/library/manga`, { waitUntil: 'networkidle' })
    await mangaCard.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    await mangaCard.click()
    await page.waitForURL('**/entry/manga/komikcast/**')

    const chapterRows = page.locator('[data-testid="item-open"]')
    await chapterRows
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => {})

    for (const at of [0, 1, 2]) {
      await chapterRows.nth(at).click()
      await page.waitForURL('**/read/**')

      const images = page.locator('[data-testid="reader"] img')
      const shown = await waitUntil(
        async () => (await images.count()) === FIXTURE_PAGES.length,
        20_000,
      )
      const sources = await images.evaluateAll((els) => els.map((el) => el.getAttribute('src')))
      check(
        `chapter terunduh ke-${at + 1} terbaca penuh tanpa jaringan`,
        shown && sources.every((src) => (src ?? '').startsWith('blob:')),
      )

      await page.keyboard.press('Escape')
      await page.waitForURL('**/entry/manga/komikcast/**')
    }

    // Yang belum diunduh tidak boleh diam-diam kosong: harus ada penjelasan.
    await chapterRows.nth(3).click()
    await page.waitForURL('**/read/**')
    const readerError = page.locator('[data-testid="reader-error"]')
    await readerError.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {})
    const message = ((await readerError.textContent()) ?? '').trim()
    check(
      `chapter yang belum diunduh menjelaskan kenapa ("${message.slice(0, 60)}")`,
      message !== '',
    )
    check(
      'tombol coba lagi tersedia di layar kegagalan',
      await page.getByRole('button', { name: 'Coba lagi' }).isVisible(),
    )

    await page.keyboard.press('Escape')
    await page.waitForURL('**/entry/manga/komikcast/**')
    await page.unroute('http://localhost:5181/**')

    // 13. Fase 7 — mengunduh satu episode HLS, lalu menontonnya tanpa jaringan.
    //
    //     Bergantung pada anime yang sudah dipasang blok 11, jadi keduanya
    //     dilewati bersama kalau ffmpeg tidak ada. Yang ditiru cuma daftar
    //     videonya; unduhannya menjalankan pipa aslinya — playlist dibedah,
    //     `#EXT-X-MAP` dan lima segmennya turun satu per satu ke OPFS, dan
    //     playlist lokal ditulis paling akhir sebagai tanda episodenya utuh.
    if (!fixtureVideo || !fixtureHls) {
      console.log('  … ffmpeg tidak ada, cek unduhan episode dilewati')
    } else {
      const animeQuery = (sql, params = []) =>
        page.evaluate(([text, values]) => globalThis.__db.query(text, values), [sql, params])

      await page.goto(`${BASE}/library/anime`, { waitUntil: 'networkidle' })
      const animeEntry = page.locator('[data-testid="entry-grid"] a[href*="uji-smoke"]').first()
      await animeEntry.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
      await animeEntry.click()
      await page.waitForURL('**/entry/anime/otakudesu/**')

      const episodeDownloads = page.locator('[data-testid="item-download"]')
      await episodeDownloads
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => {})
      check('tiap episode punya tombol unduh', (await episodeDownloads.count()) === 3)

      // Jembatan pemutar ikut termuat bersama antrean unduhan — antreannya yang
      // memanggil `loadVideos()`, jadi daftar tiruan ini yang dipakainya.
      await page.waitForFunction(() => globalThis.__player !== undefined, null, { timeout: 20_000 })
      await page.evaluate((src) => {
        globalThis.__player.fixture([{ url: src, quality: '720p', type: 'hls', subtitles: [] }])
      }, fixtureHls)

      // Baris teratas = episode 3, satu-satunya yang belum disentuh blok 11.
      const episodeId = (await animeQuery("SELECT id FROM item WHERE url LIKE '%uji-smoke-3/'"))[0]
        ?.id
      await episodeDownloads.first().click()

      const episodeDone = await waitUntil(async () => {
        const rows = await animeQuery(
          "SELECT state FROM download WHERE item_id = ? AND state = 'done'",
          [episodeId],
        )
        return rows.length === 1
      }, 60_000)
      check('episode HLS selesai diunduh', episodeDone)
      check(
        'episode terunduh bertanda di tabel item',
        (await animeQuery('SELECT downloaded FROM item WHERE id = ?', [episodeId]))[0]
          ?.downloaded === 1,
      )

      // Inti verifikasi fase ini: jalur ke sumber diputus, lalu episodenya harus
      // tetap jalan dari awal sampai ujung — segmennya dibaca dari berkas di
      // perangkat lewat loader hls.js sendiri. Daftar video tiruan ikut hilang
      // di muat ulang, jadi tidak ada jalan lain selain berkas itu.
      await page.route('http://localhost:5181/**', (route) => route.abort())
      await page.reload({ waitUntil: 'networkidle' })
      await page.goto(`${BASE}/watch/${encodeURIComponent(episodeId)}`, {
        waitUntil: 'networkidle',
      })

      const localVideo = page.locator('[data-testid="player-video"]')
      await localVideo.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
      const localTime = page.locator('[data-testid="player-time"]')
      const localDuration = await waitUntil(
        async () => /\/ 0:30$/.test(((await localTime.textContent()) ?? '').trim()),
        30_000,
      )
      check('episode terunduh terbaca durasi penuhnya tanpa jaringan (0:30)', localDuration)
      check(
        'kualitasnya ditandai berasal dari perangkat',
        (await page.locator('[data-testid="player-quality"]').textContent())?.includes('Terunduh'),
      )

      // Diputar dari tombol, bukan menunggu putar-sendiri: halaman ini dibuka
      // lewat alamat langsung, dan Chromium menolak `play()` tanpa satu pun
      // ketukan pengguna di halamannya.
      await page.locator('[data-testid="player-toggle"]').click()
      const localRunning = await waitUntil(
        async () => (await localVideo.evaluate((el) => el.currentTime)) > 0,
        20_000,
      )
      check('episode terunduh benar-benar diputar', localRunning)

      // Melompat ke detik 26 memaksa segmen terakhir dibaca dari OPFS, bukan
      // cuma segmen pertama yang kebetulan sudah di buffer — dan menunggunya
      // lewat detik 27 membuktikan segmen itu benar-benar ikut terurai.
      await seekPlayer(page, 26)
      const localEnd = await waitUntil(
        async () => (await localVideo.evaluate((el) => el.currentTime)) >= 27,
        20_000,
      )
      check('segmen terakhir ikut terbaca dari berkas, bukan cuma yang pertama', localEnd)

      await page.unroute('http://localhost:5181/**')
      await page.keyboard.press('Escape')
    }

    // 14. Route tak dikenal jatuh ke halaman 404, bukan layar putih.
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
