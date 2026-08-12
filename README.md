# Mirai

Pembaca manga dan pemutar anime dengan sistem **extension** — Mirai tidak
membawa satu pun sumber konten. Katalog datang dari extension yang kamu pasang
sendiri dari repo pilihanmu, mengikuti pola
[Aniyomi](https://github.com/aniyomiorg/aniyomi) dan
[keiyoushi/extensions](https://github.com/keiyoushi/extensions).

Web-first, mobile-first, dan bisa dibungkus jadi APK lewat Capacitor. Library,
riwayat, dan progres baca/tonton tersimpan lokal di SQLite sehingga tetap
terbuka tanpa internet. Baca dan nonton tetap butuh koneksi **kecuali** chapter
atau episodenya sudah diunduh.

**Stack** — Vue 3 · Vite 8 · TypeScript · Tailwind v4 · shadcn-vue (reka-ui) ·
Pinia · Capacitor 8 · SQLite · pnpm workspaces

## Menjalankan

```bash
pnpm install
cp apps/proxy/.env.example apps/proxy/.env

pnpm --filter @mirai/extensions build   # extension → extensions/dist
pnpm dev                                # http://localhost:5180
pnpm dev:proxy                          # http://127.0.0.1:5181, di terminal lain
```

Di build web semua request extension menempuh proxy, jadi tanpa `pnpm dev:proxy`
halaman Browse memuat daftar sumbernya tapi tidak bisa mengambil katalog. Hasil
build extension disajikan di `/ext-dev` sebagai repo lokal selama dev.

| Perintah                            | Fungsi                                         |
| ----------------------------------- | ---------------------------------------------- |
| `pnpm dev`                          | Dev server app (port 5180, `strictPort`)       |
| `pnpm dev:proxy`                    | Proxy CORS + stream untuk build web            |
| `pnpm build`                        | Build seluruh workspace                        |
| `pnpm typecheck`                    | `vue-tsc` di seluruh workspace                 |
| `pnpm lint` / `pnpm lint:fix`       | ESLint                                         |
| `pnpm format` / `pnpm format:check` | Prettier                                       |
| `pnpm test`                         | Vitest                                         |
| `node scripts/smoke.mjs`            | Smoke test Playwright (butuh `pnpm dev` jalan) |

## Struktur

```
apps/app         Vue SPA + host Capacitor — ini yang jadi APK
apps/proxy       Proxy CORS/stream untuk build web
packages/
  extension-api      Kontrak extension. Nol dependensi.
  extension-lib      Toolkit penulis extension (parser, http, resolver)
  extension-runtime  Loader + sandbox Worker + manajemen repo
  db                 Skema SQLite, migrasi, repositories
extensions       Source extension bawaan + skrip build repo
```

Alasan pembagiannya ada di [docs/architecture.md](docs/architecture.md).

## Build Android

Belum tersedia — Fase 8. Butuh Android SDK yang saat ini belum terpasang di
mesin pengembangan.

## Roadmap

| Fase | Isi                                              | Status |
| ---- | ------------------------------------------------ | ------ |
| 0    | Fondasi monorepo, shell layout, tooling          | ✅     |
| 1    | Extension API, runtime sandbox, proxy            | ✅     |
| 2    | Repo extension, manajemen, Komikcast + Otakudesu | ✅     |
| 3    | SQLite, Library offline-first, Updates           | ✅     |
| 4    | Reader manga (paged + webtoon)                   | ✅     |
| 5    | Player anime                                     | ✅     |
| 6    | Unduh manga                                      | ✅     |
| 7    | Unduh anime (mp4 + HLS)                          | ⬜     |
| 8    | Build Android (APK)                              | ⬜     |
| 9    | Backup, tracker, polish                          | ⬜     |

Rincian tiap fase: [docs/roadmap.md](docs/roadmap.md).

## Dokumentasi

| Dokumen                                      | Isi                                       |
| -------------------------------------------- | ----------------------------------------- |
| [docs/PRD.md](docs/PRD.md)                   | Masalah, tujuan, scope, non-goals         |
| [docs/DESIGN.md](docs/DESIGN.md)             | Token warna, tipografi, pola komponen     |
| [docs/architecture.md](docs/architecture.md) | Lapisan, alur data, jaringan, penyimpanan |
| [docs/conventions.md](docs/conventions.md)   | Aturan koding yang wajib diikuti          |
| [docs/roadmap.md](docs/roadmap.md)           | Fase 0–9 dan kriteria selesainya          |
| [docs/features/](docs/features/)             | Satu dokumen per fitur                    |
| [docs/extensions/](docs/extensions/)         | Cara menulis extension + API reference    |
| [CHANGELOG.md](CHANGELOG.md)                 | Riwayat rilis                             |

## Menulis extension

Sumber adalah paket terpisah yang mengimplementasikan satu interface dan
dijalankan di dalam Web Worker terisolasi. Mulai dari
[docs/extensions/writing-an-extension.md](docs/extensions/writing-an-extension.md).

## Catatan

Mirai adalah klien kosong. Repo extension yang kamu tambahkan dan kepatuhan pada
ketentuan layanan situs sumbernya adalah tanggung jawabmu sendiri.
