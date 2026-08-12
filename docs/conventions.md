# Konvensi

Aturan di bawah berlaku di semua fase. Kalau sebuah aturan menghalangi, ubah
dokumen ini dulu — jangan buat pengecualian diam-diam.

## Bahasa

- Komentar kode dan string yang dilihat pengguna: **Bahasa Indonesia**.
- Identifier (nama variabel, fungsi, tipe, tabel): **Inggris**.
- Komentar menjelaskan **kenapa**, bukan **apa**. Kalau sebuah baris menjaga
  sebuah jebakan, jebakannya ditulis di situ.

## TypeScript

- `strict` menyala, ditambah `noUncheckedIndexedAccess` dan
  `exactOptionalPropertyTypes`.
- `any` dilarang (`@typescript-eslint/no-explicit-any: error`). Data yang masuk
  aplikasi berasal dari kode extension pihak ketiga; batas tipenya harus dijaga
  saat kompilasi. Kalau bentuknya belum diketahui, pakai `unknown` lalu
  persempit.
- Import tipe pakai `import type` / `type` inline.
- TypeScript dipatok `~6.0.x` (tilde, bukan caret). `typescript-eslint` 8.x
  hanya menerima `<6.1.0`; caret akan menaikkannya diam-diam dan memecah lint.

## Lapisan

`UI → store → service → repository → Db`. Melompati lapisan tidak boleh:

- komponen tidak memanggil repository;
- store tidak menulis SQL;
- service adalah satu-satunya tempat transaksi lintas-tabel dibuka.

## Penamaan berkas

| Jenis      | Pola                                     | Contoh                                 |
| ---------- | ---------------------------------------- | -------------------------------------- |
| Halaman    | `PascalCasePage.vue` di `pages/<fitur>/` | `pages/library/LibraryPage.vue`        |
| Komponen   | `PascalCase.vue`                         | `components/layout/SideRail.vue`       |
| Repository | `camelCase.repo.ts`                      | `repositories/entry.repo.ts`           |
| Service    | `camelCase.service.ts`                   | `services/download.service.ts`         |
| Store      | kata benda huruf kecil                   | `stores/library.ts`                    |
| Extension  | `extensions/src/<lang>/<slug>/index.ts`  | `extensions/src/id/komikcast/index.ts` |

Route diberi nama (`name`), dan navigasi menunjuk ke nama tersebut — bukan ke
path — supaya URL bisa berubah tanpa menyentuh navigasi.

## Komponen UI

- shadcn-vue di-vendor tangan, bukan lewat CLI. Satu folder per komponen:
  `index.ts` memegang `cva()` + re-export, `Komponen.vue` membungkus `Primitive`
  reka-ui dan menggabung kelas lewat `cn()`.
- Warna **selalu** lewat token semantik (`bg-primary`, `text-muted-foreground`,
  `bg-unread`). Tidak ada hex atau warna Tailwind mentah di komponen.
- Daftar navigasi punya satu sumber: `components/layout/navItems.ts`.

## Extension

- `extension-api` tidak boleh punya dependensi runtime. Selamanya.
- Perubahan yang merusak kontrak menaikkan `apiVersion`; runtime menolak
  extension yang tidak cocok dengan pesan yang menyebut versi keduanya.
- Extension tidak pernah memanggil `fetch` global secara langsung — selalu lewat
  `HttpClient` yang disuntikkan, supaya rate limit dan cookie tetap di host.

## Test

- `vitest` untuk unit dan kontrak.
- `scripts/smoke.mjs` (Playwright) untuk alur end-to-end di browser sungguhan,
  minimal di 375px dan 1440px.
- Setiap fase menutup dengan `pnpm build`, `pnpm typecheck`, `pnpm lint`,
  `pnpm format:check`, dan smoke yang hijau. Hasilnya ditulis di CHANGELOG.

## Dokumentasi

- Dokumen fitur ditulis **bersamaan** dengan fiturnya, bukan belakangan.
- Template `docs/features/<fitur>.md`:

  ```
  # Fitur: <Nama>
  **Status:** <status> · **Route:** `/x`
  ## Tujuan
  ## User Flow
  ## Data & Aturan
  ## Kode          ← daftar path berkas + apa perannya
  ```

- CHANGELOG mengikuti Keep a Changelog + SemVer, satu fase = satu rilis minor,
  entrinya menautkan ke dokumen fitur agar tetap ringkas.

## Commit

Conventional Commits dengan scope, subjek Bahasa Indonesia, huruf kecil, tanpa
titik di akhir:

```
feat(reader): mode webtoon continuous
fix(proxy): teruskan Range apa adanya biar seek video tidak mengulang dari awal
docs(extensions): panduan menulis source manga
chore(deps): pin typescript ke 6.0.x
```

Commit dibuat **kecil dan fokus** mengikuti seam alami (skema → service → UI →
docs), bukan satu commit gemuk per fase. Body menjelaskan akar masalah atau
mendaftar perubahan. Trailer:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
