# Fitur: Player anime

**Status:** ✅ Selesai (Fase 5 · pemutaran offline di Fase 7) · **Route:** `/watch/:itemId(.*)`

## Tujuan

Menonton satu episode sampai habis, dari sumber mana pun yang dikembalikan
extension — mp4 langsung, HLS, atau sekadar tautan halaman player pihak ketiga.
Yang dijaga sama seperti reader, cuma satuannya berganti dari halaman jadi detik:

1. Posisi tonton tidak boleh hilang. Keluar di menit ke-8 lalu masuk lagi harus
   mendarat di menit ke-8.
2. Episode yang sudah ditonton habis bertanda selesai dengan sendirinya.
3. **Berganti kualitas atau host tidak mengulang dari awal.**

Sejak Fase 7 ada satu lagi: episode yang sudah diunduh diputar **tanpa jaringan
dan tanpa extension sama sekali** — termasuk HLS yang isinya ratusan segmen.
Yang mengunduhnya dijelaskan di [downloads.md](downloads.md); yang di sini cuma
sisi memutarnya.

## User Flow

1. Halaman detail sebuah judul anime → ketuk baris episode, atau tombol
   **Lanjut** yang menunjuk episode belum ditonton paling awal.
2. Pemutar terbuka layar penuh tanpa nav. Kendali tampil sebentar lalu
   menghilang sendiri selama video berjalan, dan menetap selama video dijeda.
3. Ketuk video untuk memanggil/menyembunyikan kendali. Papan ketik: spasi atau
   `k` untuk main/jeda, `←`/`→` mundur/maju 10 detik, `s` lewati opening, `n`/`p`
   pindah episode, `Esc` keluar.
4. Bilah bawah berisi penggeser posisi, waktu, tombol **Lewati** (±85 detik,
   bisa disetel), label kualitas yang sedang dipakai, dan lompat episode.
5. **Setelan** berisi daftar kualitas & host, daftar takarir, kecepatan, panjang
   lompatan, lanjut otomatis, layar penuh, dan kunci orientasi (APK saja).
6. Melewati 90% durasi → episode bertanda sudah ditonton dan Riwayat terisi.
7. Video habis → episode berikutnya dibuka sendiri kalau setelannya menyala.
8. Episode yang sudah diunduh langsung diputar dari perangkat, dengan satu
   kualitas berlabel **Terunduh** dan takarir yang ikut tersimpan. Jaringan
   boleh mati sepenuhnya.

## Data & Aturan

### Progres ditulis tiap lima detik, bukan tiap `timeupdate`

`timeupdate` menyala 4–66 kali per detik tergantung browser. Menulis SQLite
sesering itu membuat perangkat kelas menengah tersendat justru saat memutar
video. Store menyimpan detik terakhir yang tertulis dan baru menulis lagi setelah
bergeser lima detik — cukup rapat untuk melanjutkan tanpa terasa mundur, cukup
jarang untuk tidak mengganggu pemutaran. Melompat manual juga langsung memicu
laporan, jadi posisinya tidak menunggu lima detik pemutaran nyata.

### "Selesai" berarti 90% durasi, bukan detik terakhir

Episode anime hampir selalu ditutup ending dan pratinjau episode berikutnya —
sekitar satu setengah menit dari 24 menit — dan orang berhenti di situ. Menuntut
detik terakhir membuat episode yang jelas sudah ditonton tetap bertanda belum,
dan itu merusak Updates serta tombol Lanjut sekaligus. Ambangnya
(`FINISHED_RATIO`) hidup di `playback.ts` bersama aturan pemilihan kualitas,
terpisah dari database dan elemen video supaya bisa diuji sendirian.

### Episode yang sudah tamat dibuka dari awal

Sama dengan reader: `resumeAt()` mengembalikan 0 kalau `seen = 1`, atau kalau
posisi tersimpan ternyata sudah melewati ambang selesai walau tandanya belum
sempat tertulis — misalnya aplikasi tertutup tepat sebelum itu.

### Berganti kualitas = mengganti sumber, bukan membuka ulang episode

Ini kriteria selesai fase ini, dan ditegakkan lewat pembagian peran: store
memegang _angka_ (detik, durasi, sedang jalan atau tidak), `VideoStage` memegang
_elemennya_. Sebelum sumber ditukar, `selectVideo()` menyalin `currentTime` ke
`resumeTo`; elemen video memasangnya kembali begitu metadata sumber baru siap,
lalu mengabarkan `resumed` supaya `resumeTo` dikosongkan dan tidak dipakai dua
kali. Label kualitas yang dipilih ikut tersimpan sebagai preferensi, jadi episode
berikutnya langsung mendarat di kualitas yang sama — kecuali host `embed`, yang
labelnya nama situs, bukan kualitas.

Kalau label persisnya tidak ada di episode berikutnya, `pickVideo()` turun ke
tinggi gambar terdekat **di bawahnya**: orang yang sengaja memilih 720p demi
kuota lebih baik dapat 480p daripada tiba-tiba 1080p.

### URL video tidak diseragamkan

Tiap jenis butuh perlakuan berbeda, dan menyeragamkannya di satu tempat justru
memecahkan salah satunya:

- **mp4/dash** — `<video src>` diisi alamat proxy, karena elemen video tidak bisa
  mengirim `Referer` sendiri sementara CDN anime rutin menolak tanpa itu.
- **HLS** — playlist-nya tetap dimuat dengan alamat asli, dan yang dibelokkan ke
  proxy cuma permintaan di dalam `loader` hls.js. Alasannya: URL segmen di dalam
  playlist sering relatif, dan kalau playlist-nya sendiri dianggap berasal dari
  alamat proxy, segmennya diselesaikan terhadap alamat proxy dan tidak pernah
  ketemu. Karena itu loader-nya mengembalikan URL asli di `onSuccess` — hls.js
  yang menghitung alamat relatif, proxy yang mengambilkannya.
- **Takarir** — lewat `HttpClient` biasa, bukan `<track src>` langsung, karena
  isinya perlu dibaca dan dikonversi dulu.

### Skema lokal melewati proxy

`data:`, `blob:`, `file:`, `capacitor:`, dan `ionic:` dipakai apa adanya. Tidak
ada yang bisa diambilkan proxy dari alamat yang isinya sudah ada di perangkat
ini. Ini jalur yang dipakai episode terunduh, dan yang membuat berkas uji di
smoke test bisa diputar tanpa jaringan sama sekali.

### Episode terunduh mendahului jaringan, dan menyembuhkan tanda yang basi

`resolveVideos()` memeriksa `downloaded = 1` sebelum menyentuh extension —
persis seperti `loadPages()` di reader. Kalau berkasnya ada, itu yang dipakai
walau jaringannya sehat: itulah gunanya mengunduh. Kalau direktorinya ternyata
kosong (OPFS dibuang browser, berkasnya dihapus dari luar), tandanya diturunkan
di tempat lalu videonya diambil dari jaringan seperti biasa.

Karena itu pula `open()` di store menerima sumber yang tidak ada tanpa
mengeluh: extension yang dicopot tidak boleh membuat episode yang sudah ada di
perangkat mendadak tidak bisa diputar. Yang memutuskan cuma `resolveVideos()`,
satu-satunya tempat yang tahu berkasnya benar-benar ada.

Episode lokal muncul sebagai **satu** pilihan berlabel `Terunduh`. Label itu
sengaja tidak ikut tersimpan sebagai kualitas pilihan — "Terunduh" bukan
kualitas, dan menyimpannya membuat unduhan berikutnya kehilangan acuan waktu
memilih varian.

### Segmen lokal dibaca loader, bukan diubah jadi ratusan `blob:`

Playlist HLS yang tersimpan menyebut segmennya dengan nama relatif; salinan yang
diserahkan ke hls.js sudah berisi `mirai-local://<path>` absolut. Skema itu tidak
dikenal browser mana pun, dan memang tidak perlu: `createLocalLoader` menangkap
alamat berawalan itu dan membacanya lewat `storage.service`, sementara alamat
lain diteruskan ke loader proxy di bawahnya.

Alternatifnya — membuat object URL untuk tiap segmen di depan — berarti menahan
seluruh episode di memori sekaligus. Loader membuka satu berkas, menyerahkan
byte-nya, lalu mencabut alamatnya; hls.js yang menentukan kapan segmen
berikutnya dibutuhkan.

Permintaan yang keburu dibatalkan (`abort()`) tidak jadi membuka berkasnya, dan
berkas yang hilang dilaporkan sebagai gagal alih-alih menggantung — pemutar yang
diam tanpa pesan lebih buruk daripada pesan yang menyuruh mengunduh ulang.

### Takarir dikonversi, bukan disodorkan mentah

Browser cuma mengerti WebVTT. Sumber anime Indonesia mengirim SRT dan ASS/SSA,
jadi keduanya dikonversi di `subtitle.ts`: SRT tinggal mengganti koma jadi titik
di stempel waktu dan menambahkan `WEBVTT`, sedangkan ASS dibaca kolomnya dari
baris `Format:` (urutan kolom `Dialogue:` tidak dijamin sama antar berkas) dan
tag gaya `{\pos(…)}` dibuang. Hasilnya jadi `Blob` `text/vtt` dan dipasang
sebagai object URL yang dicabut waktu pemutar ditutup.

Track yang dipasang selalu **satu** — yang sedang aktif. Menjejalkan semuanya
sekaligus lalu mengatur `mode` per track terdengar lebih rapi, tapi tiap browser
punya kebiasaan berbeda soal kapan `mode` boleh diubah, dan hasilnya takarir yang
kadang muncul kadang tidak. Takarir yang gagal diambil cuma memunculkan pesan
melintas — videonya tidak ikut mati.

### Pemulihan HLS cuma sekali per jenis kegagalan

Segmen yang putus di tengah jalan cukup dimuat ulang (`startLoad()`), buffer yang
rusak cukup di-reset (`recoverMediaError()`). Yang tidak boleh terjadi adalah
memulihkan tanpa henti: video yang diam sambil mencoba ulang selamanya lebih
buruk daripada pesan error yang menyuruh pindah host. Karena itu tiap jenis
kegagalan dapat tepat satu kesempatan, sesudah itu pemutarnya dibongkar dan
alasannya ditampilkan.

### hls.js dimuat kalau dibutuhkan saja

±500 kB, dan orang yang cuma membaca manga tidak perlu mengunduhnya sama sekali.
Seluruh singgungan dengan pustaka itu dikurung di `hls.service.ts` dan diambil
lewat `import()` dinamis, jadi Vite memisahkannya jadi chunk sendiri. Di Safari
dan WebView iOS yang tidak mendukung Media Source, playlist-nya diserahkan
langsung ke `<video>` karena keduanya memutar HLS sendiri.

### Host `embed` diakui apa adanya

Sebagian sumber cuma memberi alamat halaman player pihak ketiga, bukan berkas
video. Tidak ada yang bisa dipasang ke `<video>`, jadi pemutarnya berkata jujur:
satu tombol membuka halamannya di peramban, satu lagi membuka daftar host lain.
Karena itu pula `pickVideo()` mendahulukan tipe yang benar-benar bisa diputar —
host `embed` baru dipilih kalau memang tidak ada pilihan lain.

Menampilkannya di dalam `iframe` sudah dipertimbangkan dan ditolak: host semacam
itu hampir selalu memasang `X-Frame-Options`/`frame-ancestors` yang membuat
bingkainya kosong, dan yang tidak memasangnya pun menuntut `Referer` tertentu
yang tidak bisa dipalsukan dari `iframe`. Di APK nanti tautannya dibuka di
**WebView in-app**, bukan tab peramban luar — lihat "Yang sengaja belum ada".

### Setelan berlaku global

Kualitas terakhir, kecepatan, panjang lompatan, volume, lanjut otomatis, layar
penuh, dan orientasi disimpan sebagai satu nilai JSON di tabel `setting`
(`player.prefs`) — jadi ikut terbawa backup di Fase 9. Bukan per judul, dengan
alasan yang sama seperti setelan reader.

### Pindah episode mengganti alamat, tidak menumpuknya

`router.replace()`. Kalau tidak, tombol kembali setelah lanjut-otomatis lima
episode berarti menelusuri lima episode itu mundur satu per satu alih-alih
kembali ke halaman judulnya.

## Yang sengaja belum ada

- **Playback native tanpa proxy.** Spike-nya sudah tertulis di kode — `transport.media.toDisplayUrl()`
  adalah fungsi identitas di native, jadi WebView mengambil medianya sendiri
  lengkap dengan header lewat `CapacitorHttp` — tapi buktinya menunggu APK di
  Fase 8. Proxy tetap jalur yang dijamin bekerja di web.
- **WebView in-app untuk host `embed`.** Di APK, membuka halaman player pihak
  ketiga sebaiknya lewat WebView aplikasi (`@capacitor/browser` atau WebView
  sendiri), bukan melempar ke peramban luar — sama alasannya dengan verifikasi
  Cloudflare di [cloudflare.md](cloudflare.md): cookie dan sesi tetap di dalam
  aplikasi. Sekarang tautannya masih `target="_blank"`, yang di APK berarti
  peramban luar. Dikerjakan bersama Fase 8.
- **Gestur usap untuk terang/volume/geser** ala pemutar Android. Papan ketik dan
  penggeser sudah cukup untuk web; gesturnya menunggu APK.
- **Trek audio ganda (dub).** `SVideo.audios` sudah ada di kontrak extension,
  tapi belum ada pemilihnya di UI.
- **Chapter/marker skip otomatis.** "Lewati" masih tombol manual sepanjang durasi
  tetap, bukan deteksi opening.

## Kode

| Path                                                | Fungsi                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/app/src/services/playback.ts`                 | Aturan murni: pilih kualitas, ambang selesai, detik lanjut, format waktu        |
| `apps/app/src/services/player.service.ts`           | Daftar video: berkas lokal dulu, lalu source; takarir, progres, setelan         |
| `apps/app/src/services/localMedia.ts`               | Episode terunduh: playlist dilokalkan, katalog takarir, pelepas alamatnya       |
| `apps/app/src/services/hlsPlaylist.ts`              | `localizePlaylist()`/`localPathOf()` — skema `mirai-local://`                   |
| `apps/app/src/services/hls.service.ts`              | Memasang sumber ke `<video>`: hls.js, HLS bawaan, atau `src` biasa              |
| `apps/app/src/services/hlsLoader.ts`                | Loader hls.js: ke proxy tanpa merusak URL relatif, dan ke berkas di perangkat   |
| `apps/app/src/services/subtitle.ts`                 | SRT/ASS → WebVTT                                                                |
| `apps/app/src/services/item.service.ts`             | Konteks item (entri, tetangga, nomor urut) — dipakai bersama reader             |
| `apps/app/src/stores/player.ts`                     | Keadaan sesi tonton; satu-satunya tempat aturan progres & "selesai"             |
| `apps/app/src/pages/player/PlayerPage.vue`          | Penyambung store ⇄ tampilan ⇄ layar perangkat; papan ketik                      |
| `apps/app/src/components/player/VideoStage.vue`     | Satu-satunya komponen yang menyentuh elemen `<video>`                           |
| `apps/app/src/components/player/PlayerControls.vue` | Bilah atas/bawah: keluar, penggeser, lewati, kualitas, lompat episode           |
| `apps/app/src/components/player/PlayerSettings.vue` | Panel setelan yang berlaku seketika                                             |
| `apps/app/src/router/links.ts`                      | `playerLocation()` — pembentuk rute pemutar yang aman                           |
| `apps/app/test/playback.test.ts`                    | Unit: pemilihan kualitas, ambang selesai, format waktu                          |
| `apps/app/test/subtitle.test.ts`                    | Unit: konversi SRT dan ASS                                                      |
| `apps/app/test/hlsLoader.test.ts`                   | Unit: URL asli dikembalikan ke hls.js; berkas lokal dibuka lalu dilepas         |
| `scripts/smoke.mjs`                                 | Smoke: tonton → keluar → lanjut → ganti kualitas → selesai → episode berikutnya |
| `scripts/smoke.mjs`                                 | Smoke: unduh episode HLS → putus jaringan → diputar utuh sampai segmen terakhir |
