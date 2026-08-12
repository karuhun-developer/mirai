# Roadmap

Satu fase = satu rilis minor. Tiap fase ditutup dengan `pnpm build`,
`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, dan smoke test yang hijau;
hasilnya dicatat di [CHANGELOG.md](../CHANGELOG.md).

| Fase | Versi | Isi                        | Status |
| ---- | ----- | -------------------------- | ------ |
| 0    | 0.1.0 | Fondasi monorepo           | ✅     |
| 1    | 0.2.0 | Extension API & runtime    | ✅     |
| 2    | 0.3.0 | Repo extension & manajemen | ✅     |
| 3    | 0.4.0 | DB & Library offline-first | ⬜     |
| 4    | 0.5.0 | Reader manga               | ⬜     |
| 5    | 0.6.0 | Player anime               | ⬜     |
| 6    | 0.7.0 | Unduh manga                | ⬜     |
| 7    | 0.8.0 | Unduh anime                | ⬜     |
| 8    | 0.9.0 | Build Android              | ⬜     |
| 9    | 1.0.0 | Backup, tracker, polish    | ⬜     |

---

## Fase 0 — Fondasi monorepo ✅

Monorepo pnpm, TS strict, Vite 8, Tailwind v4 tanpa config JS, shadcn-vue vendor
tangan, Pinia, router, Capacitor 8, shell layout responsif, ESLint + Prettier +
`vue-tsc`, kerangka dokumentasi.

**Selesai kalau:** perintah mutu bersih dan app bisa dinavigasi di 375px maupun
1440px. → [features/app-shell.md](features/app-shell.md)

## Fase 1 — Extension API & runtime ✅

`extension-api` (kontrak), `extension-lib` (`HttpClient`, `ParsedHttpSource`,
helper `linkedom`, `FilterList`, preferences), `extension-runtime` (sandbox
Worker + RPC + loader), `apps/proxy` (Fastify `POST /fetch`, `GET /stream`
dengan `Range`, gerbang SSRF), adapter `CapacitorHttp`. Satu extension nyata
untuk memvalidasi kontrak.

**Selesai kalau:** test kontrak hijau, dan di browser Browse → sebuah sumber
menampilkan populer, pencarian jalan, detail + daftar chapter terbuka.
→ [features/extension-runtime.md](features/extension-runtime.md) ·
[features/network-proxy.md](features/network-proxy.md)

**Catatan kemudian:** extension pertama fase ini adalah MangaDex, dan
`api.mangadex.org` tidak pernah terjangkau dari mesin pengembangan ini — DNS-nya
gagal total. Paketnya dihapus setelah Fase 2; yang membuktikan kontrak sekarang
adalah Komikcast, Mangabat, Aniwatch, dan Otakudesu, yang semuanya diuji ke situs
aslinya. Daftar chapter dan halaman baca baru punya UI di Fase 3–4.

## Fase 2 — Repo extension & manajemen ✅

`extensions/scripts/build.ts` (esbuild → ESM + `index.min.json` + ikon, plus
pemeriksaan yang menjalankan tiap bundel sekali), workflow publish ke GitHub
Pages, halaman Extension (tambah/hapus repo, pasang, update, copot, setelan per
paket, aktif/nonaktif, filter NSFW, cek `apiVersion`). Tambah **Komikcast**,
**Otakudesu**, **Mangabat**, **KunManga**, dan **Aniwatch**.

**Selesai kalau:** extension bisa dipasang dari URL repo hasil build, dan masih
terpasang setelah app dimuat ulang. → [features/extension-manager.md](features/extension-manager.md)

**Sisa utang:** setelan bersifat per paket, bukan per source — batas kontrak
`SourceContext`, baru bisa dicabut kalau kontraknya berubah (naik `API_VERSION`).
Situs dengan verifikasi Cloudflare gagal dengan pesan biasa; UI khusus "selesaikan
verifikasi" belum ada, dan penyelesaiannya tetap di tangan pengguna seperti
Aniyomi.

## Fase 3 — DB & Library offline-first

`packages/db` (skema, migrasi, driver native/web, `BaseRepository`), Library
(favorit, kategori, tab, badge belum dibaca, sort/filter), detail entri, daftar
chapter/episode, history, Updates, cache cover.

**Selesai kalau:** dengan jaringan dimatikan, library, kategori, dan history
tetap tampil; data bertahan setelah reload.

## Fase 4 — Reader manga

Paged (LTR/RTL) dan webtoon continuous, preload, zoom/pan, tap zone + keyboard,
progres per halaman, fullscreen, kunci orientasi di native.

**Selesai kalau:** keluar di tengah chapter lalu masuk lagi mendarat di halaman
yang sama, dan item otomatis bertanda sudah dibaca.

## Fase 5 — Player anime

`hls.js` + `<video>`, pemilih kualitas & host, subtitle, lanjut dari posisi, skip
intro, PiP, episode berikutnya. Termasuk spike playback native tanpa proxy,
dengan proxy sebagai fallback.

**Selesai kalau:** satu episode berjalan di web maupun APK, dan berganti
kualitas tidak mengulang dari awal.

## Fase 6 — Unduh manga

Antrean persist (concurrency, jeda/lanjut/ulang, bertahan setelah app ditutup),
penyimpanan Filesystem/OPFS, reader membaca dari lokal, indikator terunduh,
hapus manual dan otomatis.

**Selesai kalau:** tiga chapter terunduh tetap terbaca penuh dengan jaringan
mati, dan yang belum terunduh memberi pesan yang jelas.

## Fase 7 — Unduh anime

mp4 langsung dan HLS (ambil segmen, dekripsi AES-128, playlist lokal, loader
`hls.js` kustom yang membaca Filesystem), manajemen kuota penyimpanan.

**Selesai kalau:** satu episode HLS terunduh diputar utuh tanpa jaringan.

## Fase 8 — Build Android

`cap add android`, ikon/splash, permission, signing debug, `cap:sync`, helper
buka Android Studio, workflow rilis APK.

**Selesai kalau:** APK terpasang di perangkat fisik dan alur browse → baca →
unduh → tonton berjalan.

⚠️ **Terblokir:** Android SDK belum terpasang di mesin pengembangan.

## Fase 9 — Backup, tracker, polish

Export/import backup JSON, migrasi entri antar-sumber, mode incognito, tracker
MAL/AniList (opsional), audit aksesibilitas dan performa.

**Selesai kalau:** backup dari satu perangkat direstore di perangkat lain
menghasilkan library yang identik.
