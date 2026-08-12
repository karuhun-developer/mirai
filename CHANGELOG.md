# Changelog

Semua perubahan penting pada Mirai dicatat di sini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
versinya mengikuti [Semantic Versioning](https://semver.org/lang/id/). Satu fase
roadmap = satu rilis minor.

Setiap fitur punya dokumennya sendiri di `docs/features/`. Entri di bawah
menautkan ke sana supaya changelog ini tetap ringkas.

## [Unreleased]

### Fase 2 — Repo extension & manajemen

#### Added

- Halaman **Extension**: tambah/hapus repo, pasang, update, copot, setelan per
  paket, aktif/nonaktif, pencarian, dan saringan 18+. Sumber sekarang sepenuhnya
  dipasang pengguna — aplikasi tidak membawa satu pun. Lihat
  [docs/features/extension-manager.md](docs/features/extension-manager.md).
- `extensions/scripts/build.ts` naik dari sekadar pembungkus esbuild jadi
  pemeriksa hasil build: tiap bundel dijalankan sekali dengan konteks tiruan
  untuk mengumpulkan source-nya, jadi `export default` yang lupa, factory kosong,
  `baseUrl` di luar `hosts[]`, dan id source yang bentrok antar-paket gagal di CI.
- `.github/workflows/publish-extensions.yml` — `extensions/dist` diterbitkan ke
  GitHub Pages lewat action Pages resmi, jadi tidak ada action pihak ketiga yang
  memegang token tulis.
- Lima source baru yang membuktikan kontraknya generik di luar API resmi:
  **Komikcast** dan **Otakudesu** (id), **Mangabat**, **KunManga**, dan
  **Aniwatch** (en) — manga dan anime, scraping HTML maupun API internal.
- `extensions/scripts/smoke.mjs` — menjalankan bundel hasil build ke situs
  aslinya, dari populer sampai daftar halaman/video. Sengaja di luar CI: yang
  diujinya adalah markup pihak ketiga hari ini, bukan kode di repo ini.
  `MIRAI_SMOKE_RESOLVE` memaksa IP untuk jaringan yang memblokir lewat DNS.
- Pola bintang di allowlist proxy: `megap.*.top` cocok dengan tepat satu label.
  CDN video mengganti label tengahnya beberapa hari sekali, dan tanpa ini pemutar
  mati sampai ada rilis extension baru.
- Komponen `Switch` (shadcn-vue di atas `reka-ui`) dan `PreferenceForm` yang
  merender keempat tipe `SourcePreference` — extension mendeklarasikan setelannya,
  bukan mengirim komponen.

#### Changed

- `stores/sources.ts` → `stores/extensions.ts` dan `services/extensions.ts` →
  `services/extensions.service.ts`, ikut memuat repo, katalog, dan status
  terpasang. Browse sekarang membaca daftar sumber dari situ, dan halaman
  kosongnya menuntun ke halaman Extension alih-alih menyatakan tidak ada apa-apa.
- `/ext-dev` tidak lagi memasang extension otomatis saat `pnpm dev`; ia sekadar
  **terdaftar sebagai repo**. Jalur "tambah repo → pasang → pakai" yang dipakai
  pengguna sungguhan jadi ikut tercoba tiap hari.

#### Notes

- Bundel extension disimpan di **Cache API**, bukan `localStorage`: satu paket
  ±275 KB karena linkedom ikut dibundel, dan beberapa paket saja sudah melewati
  kuota 5 MB. Metadata (repo, daftar terpasang, setelan) tetap di `localStorage`
  karena harus terbaca sinkron saat boot.
- Bundel dibaca **cache lebih dulu, baru jaringan**, dan extension yang aktif
  dijalankan dari cache sebelum repo mana pun disentuh. Kalau kodenya harus
  diunduh ulang tiap kali app dibuka, "offline-first" cuma klaim.
- Update dan penyimpanan setelan tidak pernah mematikan worker lama sebelum
  penggantinya terbukti jalan. Update yang gagal — repo mati, bundel rusak —
  tidak boleh meninggalkan pengguna tanpa sumber yang tadinya baik-baik saja.
- Setelan bersifat **per paket**, bukan per source: `SourceContext` menyerahkan
  satu `PreferenceStore` ke seluruh factory, jadi dua source dalam satu paket
  memang berbagi ruang kunci. Ini batas kontrak, bukan jalan pintas.
- Menghapus repo tidak mencopot extension yang sudah dipasang darinya — kodenya
  ada di cache dan masih jalan; yang hilang cuma jalur update-nya. Dinyatakan di
  UI supaya tidak jadi kejutan.
- `index.min.json` diambil dengan `fetch` biasa, bukan lewat proxy. Repo adalah
  berkas statis yang memang untuk dibaca browser dan GitHub Pages mengirim
  `Access-Control-Allow-Origin: *`; melewatkannya ke proxy justru memaksa
  pengguna mendaftarkan host repo di allowlist yang dipakai untuk situs sumber.
- Situs dengan verifikasi Cloudflare mengikuti sikap Aniyomi: tantangannya
  diselesaikan pengguna sendiri, tidak diputari otomatis. Kalau tidak bisa
  diselesaikan, sumber itu memang tidak bisa dipakai.

Fase 2 terverifikasi 2026-08-12: `pnpm typecheck`, `pnpm lint`, `pnpm
format:check` bersih; `node scripts/smoke.mjs` lolos 15 pemeriksaan di 375px dan
1440px, termasuk memasang MangaDex lewat UI dari repo `/ext-dev`, memuat ulang
halaman, dan menemukannya masih terpasang serta bisa di-browse.

### Fase 1 — Extension API & runtime

#### Added

- `@mirai/extension-api` — kontrak yang dipegang extension pihak ketiga: model
  (`SManga`, `SAnime`, `SChapter`, `SEpisode`, `SPage`, `SVideo`), interface
  source, filter, preferences, dan `HttpClient`. **Nol dependensi**, dan
  `types: []` supaya tipe Node tidak pernah bocor ke permukaan API. `API_VERSION`
  dimulai dari `1`.
- `@mirai/extension-lib` — perkakas penulis extension: `ParsedHttpSource` dan
  turunan manga/anime, helper `linkedom`, builder & pembaca `FilterList`,
  pembaca JSON `unknown`, util. Boleh gemuk: paket ini dibundel ke tiap
  extension, bukan ke aplikasi.
- `@mirai/extension-runtime` — sandbox Web Worker satu per extension dengan RPC,
  pemeriksaan `apiVersion`, timeout 30 detik per panggilan, dan dua adapter HTTP
  di balik satu interface. Lihat
  [docs/features/extension-runtime.md](docs/features/extension-runtime.md).
- `apps/proxy` — Fastify 5 dengan `POST /fetch` dan `GET /stream`. Gerbang SSRF
  gagal-tertutup, redirect ditangani manual dengan pemeriksaan ulang tiap
  lompatan, `Range` diteruskan apa adanya, body di-stream tidak pernah di-buffer.
  Lihat [docs/features/network-proxy.md](docs/features/network-proxy.md).
- Extension **MangaDex** (`extensions/src/all/mangadex/`) di atas API resminya —
  extension pertama, sekaligus bukti bahwa kontraknya cukup untuk source berbasis
  API tanpa perlu base class scraping.
- Halaman **Browse**: daftar sumber terpasang, lalu Populer/Terbaru/Cari dengan
  paginasi per sumber, grid cover responsif dengan badge belum-dibaca dan penanda
  sudah-diunduh.
- `extensions/scripts/build.ts` — esbuild membundel tiap source jadi satu ESM
  plus `dist/index.min.json`. Saat `pnpm dev`, `extensions/dist` disajikan di
  `/ext-dev` sebagai repo lokal, jadi extension bisa dicoba sebelum manajemen
  repo sungguhan datang di Fase 2.
- Panduan [menulis extension](docs/extensions/writing-an-extension.md) dan
  [API reference](docs/extensions/api-reference.md).
- Test: kontrak `extension-api`, helper `extension-lib`, gerbang SSRF proxy, dan
  MangaDex dengan stub `HttpClient` + fixture. `tsconfig.test.json` memasukkan
  test ke `pnpm typecheck` — tanpa itu test tidak pernah diperiksa tipenya sama
  sekali, karena vitest hanya menjalankan.
- Smoke test diperluas: Browse harus menampilkan "MangaDex". Nama itu hanya bisa
  muncul kalau index repo terbaca, bundel-nya ter-import di dalam Worker lewat
  blob URL, factory-nya jalan, dan `describe()` kembali ke host lewat RPC — satu
  pemeriksaan yang membuktikan seluruh rantai runtime.

#### Notes

- Test gerbang SSRF menangkap satu celah sebelum kodenya sempat dipakai:
  `::ffff:127.0.0.1` lolos ke pemeriksaan allowlist karena `new URL()`
  menormalkannya jadi bentuk heksa `::ffff:7f00:1`, sedangkan pemeriksaan
  IPv4-mapped hanya mengenali notasi titik. Kedua bentuk sekarang dikenali.
- Pesan kegagalan proxy tidak berhenti di "fetch failed" — rantai `cause` dibuka
  beserta kode errornya, dan sisi klien membedakan 403 (kebijakan proxy), 502
  (sumber tidak terjangkau), dan proxy yang mati sama sekali. Tiga hal yang
  menuntut tindakan berbeda dari user.
- Kode extension diunduh **host**, lalu diserahkan ke worker sebagai string dan
  di-`import` lewat blob URL. Worker tidak pernah mengambil kodenya sendiri:
  `ctx.http` tetap satu-satunya jalur keluar, dan repo GitHub Pages tidak perlu
  memasang header CORS.
- Setelah modul dimuat, worker mematikan `fetch`, `XMLHttpRequest`, dan
  `importScripts`. `fetch` diganti fungsi yang melempar sambil menunjuk
  `ctx.http` — penulis extension harus tahu kenapa kodenya gagal, bukan
  menemukan `undefined`.
- `getJson()` sengaja mengembalikan `unknown`, bukan generic. Respons berasal
  dari jaringan; `getJson<Manga>()` hanya kebohongan tipe yang berubah jadi crash
  saat situsnya mengubah bentuk.
- Store menyimpan extension di `shallowRef`: proxy reaktif Vue akan membungkus
  instance yang memegang `Worker` dan merusak identitas kelasnya.
- `esbuild: true` di `pnpm-workspace.yaml` `allowBuilds`. Tanpa postinstall-nya,
  esbuild tidak mengunduh binary platform dan build extension gagal dengan
  "You installed esbuild for another platform".

Fase 1 terverifikasi 2026-08-12: `pnpm build`, `pnpm typecheck`, `pnpm lint`,
`pnpm format:check` bersih; `pnpm test` 58 test hijau; `node scripts/smoke.mjs`
lolos 20 pemeriksaan di dua lebar layar; gerbang SSRF dicoba langsung dengan
curl (loopback, host di luar allowlist, `file:`) dan menolak ketiganya.

**Tidak terverifikasi:** panggilan sungguhan ke `api.mangadex.org`. Host itu
tidak terjangkau dari mesin pengembangan ini — DNS gagal atau koneksi timeout,
sementara registry npm lewat — jadi pemetaan responsnya dibuktikan lewat fixture,
bukan lewat respons asli. Perlu dijalankan sekali di jaringan normal.

### Fase 0 — Fondasi monorepo

#### Added

- Monorepo pnpm workspaces: `apps/*`, `packages/*`, `extensions`. Pembagiannya
  dan alasan `extension-api` dipisah dari `extension-lib` ada di
  [docs/architecture.md](docs/architecture.md).
- `.npmrc` dengan `node-linker=hoisted` — CLI Capacitor mencari plugin native
  dengan menyisir `node_modules` secara datar, dan struktur symlink bawaan pnpm
  membuat `cap sync` tidak menemukan satu pun plugin.
- Shell layout responsif: BottomNav di bawah 768px berubah jadi SideRail di
  atasnya, dua-duanya membaca satu sumber daftar navigasi
  (`components/layout/navItems.ts`). Route menandai dirinya `meta.fullscreen`
  untuk menyembunyikan nav — reader dan player nanti tidak perlu mengubah shell.
  Lihat [docs/features/app-shell.md](docs/features/app-shell.md).
- Tema Tailwind v4 tanpa file config JS: seluruh token OKLCH tinggal di
  `apps/app/src/assets/index.css`, termasuk token khusus Mirai (`--unread`,
  `--downloaded`, `--surface`) di luar palet shadcn. Gelap jadi default.
- Komponen shadcn-vue di-vendor tangan di atas `reka-ui`: button, badge, card,
  input. Varian `unread` dan `downloaded` pada Badge sudah disiapkan untuk badge
  di pojok cover.
- `scripts/smoke.mjs` — Playwright menjalankan app sungguhan di 375px dan
  1440px, memeriksa redirect, nav yang benar per lebar layar, navigasi lintas
  halaman, CTA empty state, dan halaman 404, lalu menyimpan screenshot.
- ESLint 9 + Prettier + `vue-tsc`. `@typescript-eslint/no-explicit-any` disetel
  `error`: seluruh nilai yang masuk app nantinya berasal dari kode extension
  pihak ketiga, jadi batas tipenya harus dijaga saat kompilasi.
- CI GitHub Actions (`.github/workflows/ci.yml`): `format:check` → `lint` →
  `typecheck` → `build` → `test`, dengan `pnpm install --frozen-lockfile` supaya
  lockfile yang tidak sinkron menggagalkan build alih-alih diselesaikan diam-diam.
- `.vscode/extensions.json` merekomendasikan Volar dan menandai Vetur sebagai
  tidak diinginkan — keduanya aktif bersamaan membuat diagnostik `.vue` ganda.

#### Fixed

- `noEmit` pada `tsconfig.app.json` dan `tsconfig.node.json`. Tanpa itu
  `vue-tsc -b` menulis `vite.config.js` hasil kompilasi ke folder sumber, dan
  Vite memuat `.js` lebih dulu daripada `.ts` — dev server diam-diam memakai
  config basi dan mengabaikan `server.port`.

#### Notes

- TypeScript dipatok dengan tilde di `~6.0.3`. `typescript-eslint` 8.x hanya
  menerima `<6.1.0`, dan kombinasi `vue-tsc` 3.3 + TS 6.0 sudah terbukti di
  proyek POS Kacaw. Caret akan menaikkannya diam-diam dan memecah lint.
- `lucide-vue-next` sudah deprecated; ikonnya dari `@lucide/vue`.

Fase 0 terverifikasi 2026-08-12: `pnpm build`, `pnpm typecheck`, `pnpm lint`,
`pnpm format:check`, dan `pnpm test` bersih; `node scripts/smoke.mjs` lolos 14
pemeriksaan di dua lebar layar.
