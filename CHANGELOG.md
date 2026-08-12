# Changelog

Semua perubahan penting pada Mirai dicatat di sini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
versinya mengikuti [Semantic Versioning](https://semver.org/lang/id/). Satu fase
roadmap = satu rilis minor.

Setiap fitur punya dokumennya sendiri di `docs/features/`. Entri di bawah
menautkan ke sana supaya changelog ini tetap ringkas.

## [Unreleased]

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
