# PRD — Mirai

## 1. Ringkasan

Mirai adalah klien untuk membaca manga dan menonton anime yang **tidak membawa
sumber konten apa pun**. Seluruh katalog berasal dari _extension_ yang dipasang
pengguna dari repo pilihannya sendiri. Aplikasinya web-first (bisa dibuka di
browser) sekaligus bisa dibungkus jadi APK Android lewat Capacitor.

## 2. Masalah & tujuan

Aplikasi sejenis yang ada (Aniyomi, Tachiyomi dan turunannya) hanya hidup di
Android sebagai APK. Tidak ada jalan untuk membuka library yang sama dari
browser di laptop, dan menulis extension baru berarti menulis Kotlin lalu
mengompilasi APK.

Tujuan Mirai:

1. Satu basis kode untuk web dan Android.
2. Extension ditulis dalam TypeScript, dibundel jadi satu berkas ESM, dan
   dipasang tanpa mengompilasi ulang aplikasinya.
3. Library dan progres baca tetap terbuka saat offline; isi yang sudah diunduh
   tetap bisa dibaca dan ditonton tanpa koneksi.
4. Nyaman di layar HP **dan** di layar lebar — bukan tiruan UI Android yang
   diregangkan.

## 3. Persona

- **Pembaca harian.** Mengikuti 20–50 judul, membuka aplikasi untuk mengecek
  chapter baru. Peduli pada tab kategori, badge belum dibaca, dan kecepatan.
- **Penonton offline.** Mengunduh episode saat ada Wi-Fi, menontonnya di
  perjalanan. Peduli pada manajemen unduhan dan sisa penyimpanan.
- **Penulis extension.** Ingin menambahkan situs sumber baru tanpa menyentuh
  kode aplikasi. Peduli pada kejelasan kontrak, pesan error, dan cara mengetes.

## 4. Scope fitur

- Library anime & manga: favorit, kategori, badge belum dibaca, sort & filter.
- Browse per sumber: populer, terbaru, pencarian, filter milik sumber.
- Detail entri: metadata, daftar chapter/episode, tandai sudah dibaca.
- Updates: chapter dan episode baru dari judul di library.
- Reader manga: paged (LTR/RTL) dan webtoon continuous.
- Player anime: HLS & mp4, pilihan kualitas, subtitle, lanjut dari posisi.
- Unduhan: antrean yang bisa dijeda/dilanjut, isi terbaca penuh saat offline.
- Manajemen extension: tambah repo, pasang, update, setelan per sumber.
- Backup & restore library.

## 5. Non-goals (v1)

- Menyediakan atau menghosting konten. Mirai adalah klien kosong.
- Akun, sinkronisasi antar-perangkat, atau backend milik sendiri — kecuali
  proxy CORS tanpa status yang hanya meneruskan byte.
- iOS. Arsitekturnya tidak menutup pintu, tapi tidak dikerjakan di v1.
- Komentar, rating, atau fitur sosial.
- Tracker (MAL/AniList) — opsional dan paling akhir.

## 6. Prinsip teknis

1. **Offline dulu.** Setiap data yang sudah pernah ditampilkan harus bisa
   ditampilkan lagi tanpa jaringan.
2. **Kontrak extension adalah API publik.** Perubahan yang merusaknya harus
   menaikkan `apiVersion` dan ditolak dengan pesan jelas, bukan gagal diam-diam.
3. **Kode pihak ketiga tidak dipercaya.** Extension berjalan di Worker tanpa
   DOM, tanpa akses DB, dan seluruh requestnya diperantarai host.
4. **Gagal dengan berisik.** Situs sumber pasti berubah; error harus menyebut
   sumber dan langkah mana yang gagal, bukan sekadar layar kosong.
