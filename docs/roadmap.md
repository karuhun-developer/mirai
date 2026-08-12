# Roadmap

Satu fase = satu rilis minor. Tiap fase ditutup dengan `pnpm build`,
`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, dan smoke test yang hijau;
hasilnya dicatat di [CHANGELOG.md](../CHANGELOG.md).

| Fase | Versi | Isi                        | Status |
| ---- | ----- | -------------------------- | ------ |
| 0    | 0.1.0 | Fondasi monorepo           | ✅     |
| 1    | 0.2.0 | Extension API & runtime    | ✅     |
| 2    | 0.3.0 | Repo extension & manajemen | ✅     |
| 3    | 0.4.0 | DB & Library offline-first | ✅     |
| 4    | 0.5.0 | Reader manga               | ✅     |
| 5    | 0.6.0 | Player anime               | ✅     |
| 6    | 0.7.0 | Unduh manga                | ✅     |
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
Verifikasi Cloudflare sudah dikenali dan punya UI sendiri beserta setelan
User-Agent (→ [features/cloudflare.md](features/cloudflare.md)), tapi
menyelesaikannya butuh WebView in-app yang berbagi cookie jar dengan
`CapacitorHttp` — itu masuk Fase 8. Di build web tantangannya memang tidak bisa
diselesaikan, dan itu batas permanen, bukan utang.

## Fase 3 — DB & Library offline-first ✅

`packages/db` (skema, migrasi, driver native/web, `BaseRepository`), Library
(favorit, kategori, tab, badge belum dibaca, sort/filter), detail entri, daftar
chapter/episode, history, Updates, cache cover.

**Selesai kalau:** dengan jaringan dimatikan, library, kategori, dan history
tetap tampil; data bertahan setelah reload.
→ [features/library.md](features/library.md)

**Terverifikasi:** `scripts/smoke.mjs` menjalankan alurnya di browser sungguhan —
kartu katalog → detail → favorit → tandai dibaca, tiap langkah diperiksa langsung
ke tabelnya lewat `window.__db`, lalu jaringan ke proxy diputus dan halamannya
dimuat ulang. Library, tab kategori, dan riwayat tetap tampil.

**Sisa utang:** driver native (`@capacitor-community/sqlite`) ditulis penuh tapi
belum pernah dijalankan di perangkat — Android SDK belum ada, jadi buktinya baru
bisa diambil di Fase 8. Kolom `downloaded` dan tabel `download` sudah ada di
skema tapi belum ada yang mengisinya sampai Fase 6. Tabel `extension` dan
`source_pref` yang direncanakan di rancangan awal **tidak dibuat**: extension
sudah terlanjur (dan tepat) tinggal di `localStorage` + Cache API sejak Fase 2
karena harus terbaca sinkron sebelum database dibuka.

## Fase 4 — Reader manga ✅

Paged (LTR/RTL) dan webtoon continuous, preload, zoom/pan, tap zone + keyboard,
progres per halaman, fullscreen, kunci orientasi di native.

**Selesai kalau:** keluar di tengah chapter lalu masuk lagi mendarat di halaman
yang sama, dan item otomatis bertanda sudah dibaca.
→ [features/reader.md](features/reader.md)

**Terverifikasi:** `scripts/smoke.mjs` membuka chapter sungguhan dari Komikcast,
menukar mode lewat panel setelan, maju dua halaman, keluar lewat `Esc`, lalu
masuk lagi dan mendarat di halaman 3 — posisinya dibaca langsung dari kolom
`item.last_position`. Diteruskan sampai halaman terakhir, `item.seen` berubah
jadi 1 tanpa ditandai manual, dan halaman detail menampilkannya sebagai sudah
dibaca.

**Sisa utang:** kunci orientasi ditulis penuh tapi cuma nyata di APK, jadi
buktinya menunggu Fase 8 — sama dengan driver SQLite native. Mode halaman belum punya
tata letak dua halaman berdampingan di layar lebar, dan penanda masih setingkat
chapter, bukan per halaman.

## Fase 5 — Player anime ✅

`hls.js` + `<video>`, pemilih kualitas & host, subtitle, lanjut dari posisi, skip
intro, PiP, episode berikutnya. Termasuk spike playback native tanpa proxy,
dengan proxy sebagai fallback.

**Selesai kalau:** satu episode berjalan di web maupun APK, dan berganti
kualitas tidak mengulang dari awal.
→ [features/player.md](features/player.md)

**Terverifikasi:** `scripts/smoke.mjs` menonton satu episode dari Library →
detail → baris episode: durasi terbaca, posisi dan durasi tertulis ke
`item.last_position`/`total_position` dalam detik, riwayat terisi, keluar lewat
`Esc` lalu masuk lagi mendarat di detik yang sama, berganti kualitas lewat panel
setelan **tidak** mengembalikan posisi ke nol, melewati 90% durasi menandai
`item.seen = 1` tanpa ditandai manual, dan episode berikutnya terbuka sendiri.
Aturan murninya (pilih kualitas, ambang selesai, detik lanjut, konversi SRT/ASS,
loader HLS) diuji terpisah di `apps/app/test/`.

**Sisa utang:** episodenya berkas VP9 30 detik buatan ffmpeg yang disodorkan
lewat `window.__player.fixture()`, bukan episode Otakudesu sungguhan — situs
sumbernya tidak terjangkau dari mesin ini dan Chromium bawaan Playwright tidak
punya dekoder H.264. Artinya **HLS sungguhan lewat proxy dan playback di APK
belum terbukti berjalan**; keduanya menunggu perangkat dan jaringan yang
memungkinkan, playback native menunggu Fase 8. Host `embed` masih dilempar ke
peramban luar, belum WebView in-app. Trek audio ganda dan gestur usap ala pemutar
Android juga belum ada.

## Fase 6 — Unduh manga ✅

Antrean persist (concurrency, jeda/lanjut/ulang, bertahan setelah app ditutup),
penyimpanan Filesystem/OPFS, reader membaca dari lokal, indikator terunduh,
hapus manual dan otomatis.

**Selesai kalau:** tiga chapter terunduh tetap terbaca penuh dengan jaringan
mati, dan yang belum terunduh memberi pesan yang jelas.
→ [features/downloads.md](features/downloads.md)

**Terverifikasi:** `scripts/smoke.mjs` mengunduh tiga chapter lewat tombol di
daftar chapter, menunggu `download.state = 'done'` dan `item.downloaded = 1`
mendarat di tabel, memutus jalur ke proxy, lalu membuka ketiganya lagi — tiap
halaman datang dari alamat `blob:`, bukti berkasnya benar-benar dibaca dari
OPFS. Chapter keempat yang sengaja tidak diunduh menampilkan penjelasan beserta
tombol coba lagi, bukan layar kosong. Aturan penamaan berkasnya (sidik jari id,
padding nomor, ruas yang aman) diuji terpisah di `apps/app/test/`.

**Sisa utang:** halaman uji berupa PNG `data:` yang disuapkan lewat
`window.__downloads.fixture()` — sama alasannya dengan pemutar di Fase 5.
Artinya **jalur native (`Filesystem.downloadFile` beserta `Referer`-nya) belum
terbukti berjalan**; buktinya menunggu Fase 8. Belum ada notifikasi progres di
Android, belum ada penghapusan otomatis waktu ruang menipis, dan mengunduh masih
harus berangkat dari daftar chapter sebuah judul.

## Fase 7 — Unduh anime

mp4 langsung dan HLS (ambil segmen, dekripsi AES-128, playlist lokal, loader
`hls.js` kustom yang membaca Filesystem), manajemen kuota penyimpanan.

**Selesai kalau:** satu episode HLS terunduh diputar utuh tanpa jaringan.

## Fase 8 — Build Android

`cap add android`, ikon/splash, permission, signing debug, `cap:sync`, helper
buka Android Studio, workflow rilis APK. Ditambah **WebView in-app untuk
verifikasi Cloudflare**: harus WebView aplikasi, bukan Custom Tabs, supaya
`cf_clearance` masuk ke cookie jar yang dipakai `CapacitorHttp` — dan UA request
disamakan dengan UA WebView. Lihat [features/cloudflare.md](features/cloudflare.md).

**Selesai kalau:** APK terpasang di perangkat fisik dan alur browse → baca →
unduh → tonton berjalan.

⚠️ **Terblokir:** Android SDK belum terpasang di mesin pengembangan.

**APK dibangun di GitHub Actions, bukan di mesin ini.** Polanya mengikuti
`release-apk.yml` POS Kacaw: dipicu `release: [published]`, versinya diturunkan
dari tag `vX.Y.Z` (`versionCode = X*10000 + Y*100 + Z`), runner-nya memasang
JDK 21 + Android SDK sendiri, lalu APK-nya ditempel ke Release itu. Bedanya di
sini pakai **pnpm** (`pnpm install --frozen-lockfile`, `pnpm build`,
`pnpm --filter @mirai/app exec cap sync android`), bukan npm. Itu juga yang
menyelesaikan kendala SDK: rilis tetap bisa jalan walau mesin pengembangan tidak
punya Android SDK — yang tersisa cuma memasang dan mencoba APK-nya di perangkat
fisik.

Sekalian di fase ini: host `embed` di pemutar dibuka lewat **WebView in-app**,
bukan dilempar ke peramban luar seperti sekarang. Alasannya sama dengan
verifikasi Cloudflare — cookie dan sesinya tetap di dalam aplikasi. Lihat
[features/player.md](features/player.md).

## Fase 9 — Backup, tracker, polish

Export/import backup JSON, migrasi entri antar-sumber, mode incognito, tracker
MAL/AniList (opsional), audit aksesibilitas dan performa.

Ditambah **dwibahasa**, sengaja ditaruh di akhir supaya yang diterjemahkan sudah
tidak berubah-ubah lagi:

- **Aplikasinya** memakai i18n (`vue-i18n`), bahasa Indonesia sebagai bawaan dan
  Inggris sebagai bahasa kedua, dengan pilihan bahasa di Setelan. String UI yang
  sekarang ditulis langsung di komponen dipindah ke berkas pesan.
- **Dokumentasinya** dapat pasangan Inggris: `README_EN.md` dan `docs/en/`.
  Bahasa Indonesia tetap sumber kebenarannya — kalau keduanya berbeda, yang
  Indonesia yang benar — supaya terjemahan yang usang tidak diam-diam jadi
  rujukan.

**Selesai kalau:** backup dari satu perangkat direstore di perangkat lain
menghasilkan library yang identik, dan aplikasinya bisa berpindah bahasa tanpa
dimuat ulang.
