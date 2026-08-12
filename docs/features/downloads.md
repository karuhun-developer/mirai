# Fitur: Unduhan manga

**Status:** ✅ Selesai (Fase 6) · **Route:** `/downloads`

## Tujuan

Menyimpan chapter ke perangkat supaya bisa dibaca **tanpa internet sama sekali**
— di kereta, di pesawat, atau di tempat yang sinyalnya cukup untuk WhatsApp tapi
tidak untuk mengunduh dua puluh gambar berturut-turut.

Dua janji yang dijaga fase ini:

1. Chapter yang bertanda terunduh **selalu** dibaca dari berkas di perangkat,
   bahkan waktu jaringannya sehat. Itulah gunanya mengunduh.
2. Antreannya selamat dari aplikasi yang ditutup. Unduhan yang terpotong
   dilanjutkan sendiri waktu aplikasi dibuka lagi, bukan diulang dari nol.

Yang belum masuk di sini: **episode anime.** Video punya masalahnya sendiri
(segmen HLS, enkripsi, ukuran) dan ditangani terpisah di Fase 7.

## User Flow

1. Halaman detail sebuah judul manga → tiap baris chapter punya tombol unduh di
   kanan. Ikonnya sekaligus keadaan barisnya: panah (belum), lingkaran berputar
   (sedang, dengan persennya di subjudul), centang (tersimpan), segitiga
   (gagal).
2. Mau sekaligus? Tombol **Unduh N** di kepala daftar mengantre semua chapter
   yang belum tersimpan; tombol tong sampah di sebelahnya menghapus semua
   unduhan judul itu.
3. Halaman **Unduhan** menampilkan antrean beserta bilah progresnya, tombol
   **Jeda**/**Lanjutkan** untuk semuanya sekaligus, dan **Bersihkan yang
   selesai** untuk merapikan daftar tanpa menghapus berkasnya.
4. Yang gagal tinggal di daftar dengan pesannya, lengkap dengan tombol ulangi.
5. Buka chapter yang sudah tersimpan → reader membacanya dari perangkat.
   Jaringan boleh mati sepenuhnya.
6. **Pengaturan → Unduhan**: berapa chapter dikerjakan sekaligus (1–4), hapus
   otomatis setelah dibaca, dan berapa ruang yang sudah terpakai.

## Data & Aturan

### Antreannya di database, pekerjanya di modul

Baris `download` (`state`, `progress`, `path`, `error`) hidup di SQLite karena
aplikasi yang ditutup di tengah unduhan harus tahu apa yang belum selesai. Yang
tidak ikut ke database cuma "siapa yang sedang mengerjakan apa di tab ini".

Pekerjanya sengaja tinggal di `download.service.ts`, **bukan di store**: store
bisa dibuang router kapan saja, sedangkan unduhan tidak boleh berhenti cuma
karena halaman Unduhan ditutup. Store hanya cermin reaktifnya, dan antreannya
dinyalakan sekali dari `App.vue` — bukan dari halaman Unduhan, karena unduhan
yang tertinggal dari sesi kemarin harus lanjut walau yang dibuka Library.

Saat boot, semua baris yang tertinggal `running` dipulangkan ke `queued`. Tanpa
itu ia menggantung selamanya dengan progres beku: pekerjanya sudah mati bersama
tab sebelumnya.

### Chapter paralel, halaman berurutan

`concurrency` (bawaan 2) mengatur berapa **chapter** dikerjakan sekaligus.
Halaman di dalam satu chapter selalu satu per satu. Ini bukan soal gaya:
menembakkan dua puluh permintaan sekaligus ke CDN manga adalah cara tercepat
kena 429 atau blokir IP. Efek sampingnya kebetulan enak — progres per halaman
jadi akurat, dan hanya berkas terakhir yang mungkin separuh jadi.

### Melanjutkan yang terputus: semua berkas dilewati kecuali yang terakhir

Karena halaman ditulis berurutan, satu-satunya berkas yang mungkin terpotong
adalah yang paling belakang. Jadi `downloadChapter()` melewati semua berkas yang
sudah ada kecuali yang paling akhir secara abjad — yang itu selalu ditulis
ulang. Memeriksa keutuhan tiap berkas satu per satu jauh lebih mahal untuk
jaminan yang sama.

### "Jeda" harus terasa menekan sesuatu

Mengubah baris database saja tidak cukup: chapter yang sedang jalan akan tetap
mengunduh sisa halamannya sampai habis. Karena itu ada himpunan `stopping` yang
dibaca di sela tiap halaman, dan pekerjanya melempar penanda khusus — dibedakan
dari gagal supaya jeda tidak muncul sebagai error merah.

### Progres tidak menyentuh snapshot database

`setProgress()` sengaja tidak menjadwalkan snapshot SQLite: menulis snapshot tiap
satu gambar turun berarti puluhan tulisan penuh untuk angka yang basi satu detik
kemudian. Yang penting justru selamat — `state` dan `path` — ditulis lewat jalur
biasa. Di sisi UI, store menyegarkan diri paling cepat sekali per 400 ms.

### Nama direktori: bisa dibaca manusia + sidik jari id aslinya

Id entri dan item berisi URL sumber lengkap (`komikcast::https://…/chapter-1/`),
sementara OPFS maupun Filesystem Android menolak `/`, `:`, dan `?` di nama
berkas. Bentuk yang dipakai:

```
downloads/komikcast/one-piece-1a2b3c4d/0001-chapter-1-9f8e7d6c/001.jpg
```

Nomor chapter berpadding empat digit supaya `10` berdiri sesudah `9` waktu
dilihat lewat pengelola berkas, dan sidik jari FNV-1a 32-bit dari id aslinya
menjamin dua chapter yang namanya kebetulan sama tidak pernah jatuh ke direktori
yang sama. Nomor halaman juga berpadding (`001.jpg`) — **urutan halaman offline
dibaca dari nama berkas**, karena waktu jaringan mati `getPageList()` tidak bisa
dipanggil sama sekali.

Ekstensinya ditebak dari URL, bukan dari `Content-Type`: di native plugin
Filesystem mengunduh langsung ke berkas tujuan, jadi namanya sudah harus final
sebelum satu byte pun turun. Salah tebak tidak merusak apa pun — yang membaca
berkasnya nanti `<img>`, yang mengenali isinya sendiri.

### Dua dunia penyimpanan, satu bentuk path

- **APK:** plugin Filesystem di `Directory.Data` — direktori privat aplikasi,
  ikut terhapus waktu aplikasi di-uninstall, tanpa izin penyimpanan apa pun.
  `Filesystem.downloadFile` melakukan HTTP-nya di sisi Java: satu-satunya cara
  memasang `Referer` yang diminta CDN tanpa menyentuh CORS, sekaligus tanpa
  memuat seluruh gambar ke memori JavaScript.
- **Web:** OPFS. Bukan Cache API dan bukan IndexedDB, karena OPFS punya
  direktori sungguhan — struktur yang sama bisa dipakai di kedua sisi, dan
  menghapus satu chapter cukup menghapus satu direktori. Unduhannya lewat
  `fetch` ke alamat proxy, sebab halaman web tidak boleh memasang `Referer`
  sendiri.

Browser boleh membuang OPFS waktu ruang menipis; `navigator.storage.persist()`
diminta sekali saat unduhan pertama — bukan saat aplikasi dibuka, karena dialog
izin yang muncul tanpa sebab cuma ditolak orang.

### Reader mendahulukan lokal, dan menyembuhkan tanda yang basi

`loadPages()` selalu mencoba berkas lokal dulu kalau `downloaded = 1`. Kalau
direktorinya ternyata kosong (OPFS dibuang browser, berkasnya dihapus dari
luar), tandanya **diturunkan di tempat** lalu halamannya diambil dari jaringan
seperti biasa — jauh lebih baik daripada reader kosong yang bersikeras
chapternya ada.

Alamat halaman lokal di web berupa `blob:` yang menahan seluruh isi berkasnya di
memori sampai dicabut. Karena itu store reader mencabutnya di `close()` dan tiap
kali chapter berganti; membiarkannya berarti sepuluh chapter offline menumpuk
ratusan megabita yang tidak pernah kembali.

### Hapus setelah dibaca terjadi saat reader ditutup

Bukan saat halaman terakhir tercapai. Bedanya nyata di native: alamat berkas
lokal di sana menunjuk berkas sungguhan, jadi menghapusnya selagi gambarnya masih
terpasang membuat halaman terakhir mendadak kosong tepat di detik terakhir
membaca. Kegagalan menghapus juga ditelan — ruang tidak jadi kembali, itu saja;
ia tidak boleh merusak momen "chapter selesai dibaca".

### Membatalkan dan menghapus adalah operasi yang sama

Di penyimpanan keduanya berarti persis satu hal: hentikan kalau sedang jalan,
buang direktorinya, lupakan barisnya. Yang berbeda cuma label tombolnya.
Sebaliknya, **Bersihkan yang selesai** sengaja tidak menyentuh berkas — yang
dibersihkan daftarnya, bukan chapternya.

## Yang sengaja belum ada

- **Unduh episode anime.** Fase 7.
- **Notifikasi progres di Android.** Menyusul bersama build APK di Fase 8.
- **Batas ukuran otomatis.** Yang ada baru angka pemakaian di Pengaturan; belum
  ada yang menghapus sendiri waktu ruang menipis.
- **Unduh judul yang belum ada di library.** Antrean selalu berangkat dari
  daftar chapter sebuah judul.

## Kode

| Path                                                | Fungsi                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/app/src/services/download.service.ts`         | Antrean, pekerja, jeda/lanjut, baca lokal, hapus, auto-hapus              |
| `apps/app/src/services/downloadPath.ts`             | Nama direktori & berkas: sidik jari id, padding nomor, ruas yang aman     |
| `apps/app/src/services/storage.service.ts`          | OPFS (web) vs plugin Filesystem (native), alamat berkas, kuota            |
| `apps/app/src/stores/downloads.ts`                  | Cermin reaktif antrean; penyegaran ber-throttle 400 ms                    |
| `apps/app/src/pages/downloads/DownloadsPage.vue`    | Daftar antrean, jeda/lanjutkan semua, bersihkan yang selesai              |
| `apps/app/src/components/downloads/DownloadRow.vue` | Satu pekerjaan: keadaan, progres, ulangi, buang                           |
| `apps/app/src/components/entry/ItemRow.vue`         | Tombol unduh per chapter dengan empat keadaannya                          |
| `apps/app/src/pages/entry/EntryDetailPage.vue`      | Unduh massal + hapus seluruh unduhan judul                                |
| `apps/app/src/pages/settings/SettingsPage.vue`      | Concurrency, hapus setelah dibaca, pemakaian ruang                        |
| `apps/app/src/services/reader.service.ts`           | `loadPages()` mendahulukan lokal; `cleanupIfFinished()` saat reader tutup |
| `packages/db/src/repositories/downloads.ts`         | Tabel `download`: antre, ambil berikutnya, requeue, progres, hapus        |
| `apps/app/test/downloadPath.test.ts`                | Unit test aturan penamaan berkas                                          |
| `scripts/smoke.mjs`                                 | Smoke: unduh 3 chapter → putus jaringan → ketiganya terbaca penuh         |
