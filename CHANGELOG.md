# Changelog

Semua perubahan penting pada Mirai dicatat di sini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
versinya mengikuti [Semantic Versioning](https://semver.org/lang/id/). Satu fase
roadmap = satu rilis minor.

Setiap fitur punya dokumennya sendiri di `docs/features/`. Entri di bawah
menautkan ke sana supaya changelog ini tetap ringkas.

## [Unreleased]

### Fase 8 — Build Android

#### Added

- **Platform Android + rilis APK otomatis.** Satu Release ber-tag `vX.Y.Z` di
  GitHub memicu `release-apk.yml`, yang menurunkan `versionName` dan
  `versionCode` (`X*10000 + Y*100 + Z`) dari tag itu, membangun seluruh
  workspace dengan pnpm, `cap sync android`, lalu menempelkan
  `mirai-X.Y.Z.apk` ke Release-nya. Lihat
  [docs/features/android.md](docs/features/android.md).
- **Keystore debug bersama yang ikut di-commit**, supaya tiap rilis bisa dipasang
  menimpa rilis sebelumnya. Tanpa itu tanda tangannya berbeda tiap mesin dan
  Android menuntut uninstall — yang berarti library, riwayat, dan seluruh
  unduhan ikut hilang.
- **Ikon dan splash Mirai** untuk semua kepadatan layar, digambar
  `scripts/make-icons.mjs` memakai Playwright yang sudah ada di repo. Tidak ada
  dependensi baru: `@capacitor/assets` akan menarik `sharp` beserta binary
  native-nya untuk pekerjaan yang dijalankan dua kali seumur proyek.
- **Halaman luar dibuka di WebView aplikasi**, bukan Chrome Custom Tabs. Ini yang
  membuat alur verifikasi Cloudflare bekerja di APK: hanya WebView aplikasi yang
  berbagi cookie jar dengan `CapacitorHttp`, jadi `cf_clearance` hasil verifikasi
  ikut terpakai request berikutnya. Berlaku juga untuk host `embed` di pemutar,
  yang sebelumnya dilempar ke peramban luar dan kehilangan sesinya di sana.
  Lihat [docs/features/cloudflare.md](docs/features/cloudflare.md).
- **Kembali dari WebView langsung memuat ulang.** Kartu verifikasi memancarkan
  `solved` begitu WebView-nya ditutup, dan keempat halaman pemakainya mencoba
  lagi sendiri — bukan menyuruh orangnya mencari tombol muat ulang kedua.
- Perintah `pnpm cap:sync`, `pnpm android:open` (helper WSL → Android Studio),
  dan `pnpm android:icons`.

### Fase 7 — Unduh anime

#### Added

- **Unduh episode** lewat antrean, tombol, dan halaman yang sama persis dengan
  chapter — yang berbeda cuma isi pekerjaannya. Video `mp4`/`mkv` turun sebagai
  satu berkas dengan progres per byte; **HLS** dibaca playlist-nya, dipilih
  variannya dengan aturan kualitas yang sama seperti menonton, lalu seluruh
  segmen, kunci, dan segmen inisialisasinya diunduh berurutan. Lihat
  [docs/features/downloads.md](docs/features/downloads.md).
- **Playlist lokal ditulis paling akhir**, jadi keberadaannya berarti "seluruh
  segmennya sudah ada". Unduhan HLS yang terputus dilanjutkan dengan aturan yang
  sama seperti halaman manga — hanya berkas terakhir yang ditulis ulang — tapi
  dibatasi pada berkas yang memang direncanakan, supaya takarir dari percobaan
  sebelumnya tidak menyamar jadi segmen yang utuh.
- **Memutar episode terunduh tanpa jaringan dan tanpa extension.**
  `resolveVideos()` mendahulukan berkas lokal seperti reader mendahulukan
  halaman lokal, menawarkannya sebagai satu kualitas berlabel `Terunduh`, dan
  menurunkan tanda `downloaded` yang basi alih-alih menampilkan pemutar kosong.
- **Skema `mirai-local://` + loader hls.js pembacanya.** Playlist tersimpan
  memakai nama berkas relatif; salinan di memori yang diserahkan ke pemutar
  memakai alamat absolut, jadi direktori episode boleh berubah tanpa mematikan
  playlist. Loader membuka satu segmen pada satu waktu lalu melepasnya —
  ratusan segmen tidak jadi ratusan `blob:` yang menahan seluruh episode di
  memori.
- **Takarir ikut terunduh**, sudah dikonversi ke WebVTT, beserta `subtitles.json`
  yang menyimpan labelnya. Satu takarir yang gagal tidak menggagalkan episode
  yang sudah turun ratusan megabita.
- **Peringatan dan penjagaan ruang penyimpanan**: peringatan di halaman Unduhan
  dan Pengaturan waktu sisa ruang menipis, dan penolakan berangkat waktu tinggal
  sedikit — setengah episode yang tidak bisa diputar tapi tetap memakan ruang
  adalah hasil terburuk yang bisa terjadi. Ambangnya memakai persentase dan
  angka mutlak sekaligus.
- `scripts/smoke.mjs` mengunduh satu episode HLS, memutus jalur ke proxy, lalu
  memutarnya: durasi penuh terbaca, kualitasnya bertanda berasal dari perangkat,
  videonya benar-benar berjalan, dan melompat ke detik ke-26 tetap memutar —
  bukti segmen terakhir ikut terbaca dari berkas, bukan cuma yang pertama.

#### Fixed

- **Menutup pemutar tidak lagi mengosongkan sesi berikutnya.** `close()` dipanggil
  tanpa ditunggu dari `onBeforeUnmount`, jadi `release()` yang berada setelah
  `await` mendarat ketika episode berikutnya sudah selesai memuat — dan membuang
  daftar videonya. Akibatnya lanjut-otomatis dan membuka ulang episode berakhir
  di "tidak punya video yang bisa diputar" tanpa pesan error. Keadaannya sekarang
  dibereskan sinkron lebih dulu, dan yang ditunggu cuma tulisan ke database.
  Perbaikan yang sama diterapkan ke store reader, yang punya bentuk bug identik.

### Fase 6 — Unduh manga

#### Added

- **Antrean unduhan yang bertahan** (`/downloads`): jeda/lanjutkan semuanya,
  ulangi yang gagal, batalkan, bersihkan yang selesai, dan bilah progres per
  chapter. Keadaannya di tabel `download`, jadi aplikasi yang ditutup di tengah
  unduhan melanjutkannya sendiri waktu dibuka lagi — baris yang tertinggal
  `running` dipulangkan ke antrean saat boot. Lihat
  [docs/features/downloads.md](docs/features/downloads.md).
- **Tombol unduh di tiap baris chapter** dengan empat keadaan (belum, sedang
  dengan persennya, tersimpan, gagal), plus **Unduh N** untuk semua chapter yang
  belum tersimpan dan tombol hapus seluruh unduhan satu judul.
- **Berkasnya di Filesystem/OPFS, bukan di SQLite**: `Directory.Data` lewat
  plugin Capacitor di APK (HTTP-nya di sisi Java, jadi `Referer` yang diminta CDN
  ikut terkirim tanpa menyentuh CORS) dan OPFS di web. Nama direktorinya "bisa
  dibaca manusia + sidik jari id aslinya", dan nomor halaman berpadding
  (`001.jpg`) karena urutan halaman offline dibaca dari nama berkas.
- **Reader membaca dari perangkat** begitu chapternya bertanda terunduh, bahkan
  waktu jaringan sehat. Chapter yang tandanya basi (OPFS dibuang browser)
  diturunkan tandanya di tempat lalu diambil ulang dari jaringan, bukan
  menampilkan reader kosong.
- **Setelan unduhan** di Pengaturan: berapa chapter dikerjakan sekaligus (1–4),
  hapus otomatis setelah dibaca, dan pemakaian ruang.

#### Changed

- Halaman di dalam satu chapter diunduh **berurutan**; yang paralel chapternya.
  Menembakkan puluhan permintaan sekaligus ke CDN manga adalah cara tercepat kena 429. Efek sampingnya: hanya berkas terakhir yang mungkin separuh jadi, jadi
  melanjutkan unduhan terputus cukup menulis ulang berkas paling belakang.
- Aturan alamat media disatukan di `mediaUrl()`: alamat yang isinya sudah ada di
  perangkat (`blob:`, `data:`, `file:`, `capacitor:`, `ionic:`) tidak lagi
  dilewatkan proxy. Sebelumnya aturan ini cuma hidup di jalur HLS.

### Fase 5 — Player anime

#### Added

- **Pemutar anime** (`/watch/:itemId`) di atas `<video>` + hls.js: pemilih
  kualitas dan host, takarir (SRT/ASS dikonversi ke WebVTT), kecepatan putar,
  lompat opening yang panjangnya bisa disetel (bawaan 85 detik), Picture-in-
  Picture, lompat episode, layar penuh, dan kunci orientasi di APK. Papan ketik:
  spasi/`k`, `←`/`→`, `s`, `n`/`p`, `Esc`. Lihat
  [docs/features/player.md](docs/features/player.md).
- **Berganti kualitas tidak mengulang dari awal.** Posisi disalin sebelum sumber
  ditukar dan dipasang kembali begitu metadata sumber baru siap; kualitas yang
  dipilih tersimpan sebagai preferensi, dan episode berikutnya turun ke tinggi
  gambar terdekat **di bawahnya** kalau label persisnya tidak tersedia.
- **Progres dalam detik**, ditulis tiap lima detik alih-alih tiap `timeupdate`
  yang menyala puluhan kali per detik. Melewati 90% durasi menandai episode
  selesai dengan sendirinya — bukan detik terakhir, karena ending dan pratinjau
  hampir selalu dilewati — lalu episode berikutnya dibuka sendiri kalau lanjut
  otomatis menyala.
- **Kegagalan HLS dipulihkan tepat sekali per jenis** (muat ulang segmen, reset
  buffer) sebelum menyerah dengan pesan yang menyarankan pindah host: video yang
  diam sambil mencoba ulang selamanya lebih buruk daripada pesan error.
- **Host `embed` diakui apa adanya** — sumber yang cuma memberi halaman player
  pihak ketiga menampilkan tombol buka di peramban dan pilih host lain, bukan
  layar hitam.
- Baris episode di halaman detail kini bisa diketuk, dan tombol **Lanjut** untuk
  anime sudah aktif.
- `scripts/smoke.mjs` menonton satu episode utuh: durasi terbaca, posisi tertulis
  ke `item`, riwayat terisi, keluar lalu masuk lagi melanjutkan di detik yang
  sama, ganti kualitas mempertahankan posisi, lewat 90% menandai selesai, dan
  episode berikutnya terbuka sendiri.

#### Fixed

- **Sumber video pertama tidak pernah terpasang** karena `watch(..., { immediate:
true })` berjalan saat setup, sebelum `<video>` masuk DOM — layarnya hitam
  sampai kualitas diganti manual. Pemasangan awal dipindah ke `onMounted`.
- **Alamat lokal (`data:`, `blob:`, `file:`, `capacitor:`) ikut dilewatkan
  proxy**, padahal isinya sudah ada di perangkat. Sekarang dipakai apa adanya —
  sekalian menyiapkan jalur episode terunduh di Fase 7.

### Fase 4 — Reader manga

#### Added

- **Reader manga** (`/read/:itemId`) dengan dua mode: halaman per halaman
  (kiri→kanan dan kanan→kiri) dan gulir menerus untuk manhwa/manhua. Lengkap
  dengan preload halaman yang bisa disetel, zoom/geser lewat cubit dan ketuk
  ganda, tap zone, papan ketik (panah, spasi, `m`, `Esc`), layar penuh, dan kunci
  orientasi di APK. Lihat [docs/features/reader.md](docs/features/reader.md).
- **Progres per halaman.** Setiap perpindahan halaman menulis `item.last_position`
  dan mengisi riwayat — bukan saat keluar, karena aplikasi yang dibunuh sistem
  tidak pernah mendapat kesempatan itu. Halaman terakhir menandai chapternya
  selesai dengan sendirinya, dan chapter yang sudah selesai dibuka lagi dari awal.
- **Halaman yang gagal dimuat bisa dicoba ulang sendiri** tanpa membuka ulang
  chapternya, dengan memasang ulang elemennya — bukan menambah parameter ke URL,
  yang akan mengubah alamat proxy dan membatalkan cache-nya.
- **Panel setelan reader** yang berlaku seketika dan tersimpan di tabel `setting`,
  jadi ikut terbawa backup di Fase 9.
- Baris chapter di halaman detail kini bisa diketuk untuk langsung membaca, dan
  tombol **Lanjut** untuk manga sudah aktif. Baris episode anime tetap diam
  sampai pemutarnya hadir di Fase 5.
- `scripts/smoke.mjs` membaca satu chapter sungguhan sampai habis: maju halaman,
  keluar di tengah, masuk lagi dan mendarat di halaman yang sama, lalu sampai
  halaman terakhir dan chapternya bertanda selesai — semuanya diperiksa langsung
  ke tabel `item` lewat `window.__db`.

#### Fixed

- **Chapter yang baru dibuka di mode gulir tercatat maju beberapa halaman
  sendiri.** Selama gambar berdatangan, tinggi tiap potongan berubah dan pita
  "sedang dibaca" di tengah layar berpindah tanpa satu pun jari menyentuh layar,
  jadi posisi baca tertulis salah dan chapternya tidak pernah dilanjutkan di
  tempat yang benar. Posisi baru sekarang cuma ditulis setelah ada gulir
  sungguhan, dan halaman yang belum dimuat diberi tinggi cadangan.
- **Ketukan tunggal mengganti halaman sebelum ketukan kedua sempat dibaca**, jadi
  zoom ketuk-ganda tidak pernah bisa dipakai di mode halaman. Ketukan tunggal
  sekarang ditunda 280 ms.
- ESLint melaporkan `window`, `IntersectionObserver`, dan kawan-kawan sebagai
  identifier tak dikenal di dalam `<script setup>`: `no-undef` dimatikan
  typescript-eslint untuk `.ts` tapi override-nya tidak menyebut `.vue`.

### Fase 3 — DB & Library offline-first

#### Added

- **`@mirai/db`** — skema SQLite, migrasi bernomor, dan repository di balik satu
  interface `Db`. Drivernya dipilih saat runtime: `sql.js` di web (snapshot ke
  IndexedDB) dan `@capacitor-community/sqlite` di APK, jadi lapisan fitur tidak
  pernah tahu sedang berjalan di mana. Chapter dan episode berbagi satu tabel
  `item`; id entri/item deterministik (`sourceId::url`) supaya judul yang sama
  dari katalog, pencarian, dan riwayat tidak pernah jadi tiga baris berbeda.
- **Library offline-first** — favorit, kategori sebagai tab, badge jumlah belum
  dibaca, pengurutan (judul / ditambahkan / terakhir dibaca / belum dibaca), dan
  saringan "ada yang belum dibaca" + "sudah diunduh". Pilihan tab dan setelan
  tampilan ikut disimpan di database, bukan `localStorage`, supaya terbawa waktu
  backup di Fase 9. Lihat [docs/features/library.md](docs/features/library.md).
- **Halaman detail entri** (`/entry/:kind/:sourceId/:url`) — sinopsis, genre,
  kategori, dan daftar chapter/episode beserta penanda, "tandai sampai sini", dan
  "tandai semua". Isinya dibaca dari SQLite lebih dulu; kegagalan menyegarkan
  jadi pesan di atas daftar, bukan pengganti halaman.
- **Updates** (`/updates`) dan **Riwayat** (`/history`) yang keduanya membaca
  database lokal. Penyegaran library berjalan berurutan dengan progres, laporan,
  dan tombol Batal yang benar-benar berarti.
- **Cache cover** di Cache API berkunci URL sumber (bukan URL proxy), batas 600
  entri, dengan `useCover()` yang mengurus daur hidup `blob:` URL-nya.
- Browse kini menyimpan hasil katalognya ke database, jadi mengetuk kartu tidak
  pernah mendarat di halaman kosong dan tautan langsung ke sebuah judul tetap
  bisa dibuka. Kartu yang sudah ada di library ditandai hati.
- `scripts/smoke.mjs` memeriksa keadaan database lewat `window.__db`, bukan cuma
  layar: favorit tercatat di `entry.favorite`, menandai chapter mengisi
  `history`, lalu jaringan ke sumber diputus dan halamannya dimuat ulang —
  library, kategori, dan riwayat wajib tetap tampil.

#### Fixed

- **Chapter baru bisa hilang dari Updates.** Sinkronisasi lanjutan memakai
  `nowMs()` apa adanya, sementara Updates menyaring item yang lebih baru dari
  entrinya. Entri yang difavoritkan lalu langsung disegarkan dalam milidetik yang
  sama menghasilkan `added_at` identik, dan chapternya tidak pernah muncul.
- **Pemisahan chunk driver database batal diam-diam.** `db.ts` sengaja
  meng-`import()` drivernya secara dinamis supaya web tidak membawa plugin
  Capacitor dan APK tidak membawa 650 KB WebAssembly, tapi satu `export` biasa di
  `index.ts` menariknya kembali ke chunk utama. Chunk utama app turun dari 205 KB
  ke 159 KB.

#### Changed

- `packages/core` dan `packages/ui` yang direncanakan di rancangan awal tidak
  jadi dibuat; folder kosongnya dihapus. Isinya berupa orkestrasi tipis di atas
  repository dan komponen dengan satu pemakai — lapisannya tetap dipaksakan, tapi
  di dalam `apps/app`. Alasannya di
  [docs/architecture.md](docs/architecture.md).

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
- Pola bintang pada pembatas host proxy: `megap.*.top` cocok dengan tepat satu
  label. CDN video mengganti label tengahnya beberapa hari sekali.
- Komponen `Switch` (shadcn-vue di atas `reka-ui`) dan `PreferenceForm` yang
  merender keempat tipe `SourcePreference` — extension mendeklarasikan setelannya,
  bukan mengirim komponen.
- **Pengenalan verifikasi Cloudflare.** Transport memeriksa tiap respons dan
  melempar `CloudflareChallengeError` sebelum halaman tantangan sampai ke parser;
  Browse menampilkannya sebagai kartu tersendiri dengan tindakan yang benar
  ("selesaikan sendiri"), bukan sebagai `HTTP 403` yang membuat orang mencurigai
  parser yang tidak salah apa-apa. Syaratnya berlapis supaya 403 biasa dari situs
  ber-Cloudflare tetap error biasa. Lihat
  [docs/features/cloudflare.md](docs/features/cloudflare.md).
- Setelan **User-Agent** di Pengaturan. Kosong secara bawaan; kalau diisi ia
  menimpa UA semua extension dan dibaca ulang tiap request. Ini lever kedua yang
  didokumentasikan Aniyomi untuk kasus Cloudflare: `cf_clearance` hanya berlaku
  untuk UA yang menyelesaikan tantangan.
- `extensions/scripts/smoke.mjs` membedakan **TERTAHAN** dari **GAGAL**. Sumber
  yang tertahan tantangan bukan extension yang rusak, dan tidak lagi membuat
  skripnya keluar dengan kode gagal.

#### Fixed

- **Proxy menolak hampir semua sumber yang baru dipasang.** `PROXY_ALLOWED_HOSTS`
  adalah daftar statis yang dibaca sekali saat proxy start, sedangkan extension
  dipasang pengguna saat aplikasi sudah jalan — jadi apa pun di luar MangaDex
  (isi bawaan `.env.example`) dijamin kena `403 Host … tidak ada di allowlist`.
  Bukan kadang-kadang: selalu, dan gejalanya persis seperti sumbernya rusak.

  Pembatas host sekarang **opsional dan kosong secara bawaan**. Mengirim
  `hosts[]` dari aplikasi di tiap request sempat dipertimbangkan lalu dibuang:
  daftarnya akan datang dari pihak yang sama dengan yang mengirim URL-nya, jadi
  itu cuma lapisan kode tanpa jaminan apa pun. Yang benar-benar menjaga mesin
  tempat proxy berjalan — penolakan loopback, jaringan privat, metadata cloud,
  `file:`, dan pemeriksaan ulang di tiap lompatan redirect — tetap wajib dan
  tidak bisa dimatikan lewat env. `PROXY_ALLOWED_HOSTS` bertahan hanya untuk
  proxy yang dipasang di server dan dipakai bersama-sama.

- `hosts[]` di manifest jadi **deklarasi**, bukan gerbang: dipakai build untuk
  memastikan `baseUrl` tercakup, dan nanti untuk memberi tahu pengguna domain apa
  saja yang akan dihubungi sebuah paket.

#### Removed

- Extension **MangaDex** beserta test kontraknya. Sejak Fase 1 host-nya tidak
  pernah sekali pun terjangkau dari jaringan tempat aplikasi ini dikembangkan —
  `api.mangadex.org` gagal di tingkat DNS — jadi satu-satunya paket yang tidak
  bisa diuji ke situs aslinya justru dijadikan rujukan di docs dan smoke test.
  Perannya diambil alih Komikcast, Mangabat, Aniwatch, dan Otakudesu, yang
  semuanya dipanggil ke situs sungguhan lewat `extensions/scripts/smoke.mjs`.
  Akibatnya `extensions/test/` untuk sementara kosong: pengujian source kini
  bersandar pada smoke ke situs asli, dan test berbasis fixture menunggu source
  yang markup-nya sudah stabil.

#### Changed

- `/health` melaporkan `hostLimits`, bukan `allowedHosts`. `0` sekarang berarti
  "tanpa pembatas host" — dulu artinya "tolak semua", dan angka yang sama dengan
  arti terbalik adalah jebakan waktu mendiagnosis 403.
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
- **Di build web, verifikasi Cloudflare tidak bisa diselesaikan sama sekali**,
  dan itu dinyatakan di layar alih-alih disembunyikan di balik tombol yang
  terlihat menjanjikan. Request dikirim proxy dari sisi server, sedangkan
  `cf_clearance` terikat ke IP dan UA yang menyelesaikan tantangan. Jalannya cuma
  ada di APK, tempat `CapacitorHttp` berbagi cookie jar dengan WebView — dan
  WebView in-app-nya sendiri baru masuk di Fase 8, jadi yang selesai sekarang
  adalah pengenalan, pesan, dan setelan UA-nya. KunManga adalah sumber pertama
  yang kena; per 2026-08-12 ia menantang semua UA yang dicoba.

Fase 2 terverifikasi 2026-08-12: `pnpm typecheck`, `pnpm lint`, `pnpm
format:check` bersih; `node scripts/smoke.mjs` lolos 15 pemeriksaan di 375px dan
1440px, termasuk memasang Komikcast lewat UI dari repo `/ext-dev`, memuat ulang
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
