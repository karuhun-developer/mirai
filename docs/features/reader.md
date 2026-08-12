# Fitur: Reader manga

**Status:** ✅ Selesai (Fase 4) · **Route:** `/read/:itemId(.*)`

## Tujuan

Membaca satu chapter dari awal sampai habis, dalam dua bentuk yang sama-sama
umum di Indonesia: **halaman per halaman** seperti manga cetak (kiri→kanan atau
kanan→kiri) dan **gulir menerus** seperti manhwa/manhua. Yang dijaga sepanjang
itu cuma dua hal, dan keduanya menyangkut data:

1. Posisi baca tidak boleh hilang. Menutup aplikasi di halaman 12 lalu membukanya
   lagi harus mendarat di halaman 12.
2. Chapter yang sudah dibaca habis bertanda selesai dengan sendirinya, tanpa
   pengguna menekan tombol centang.

Sejak Fase 6 halamannya boleh datang dari dua tempat: **berkas di perangkat**
kalau chapternya sudah diunduh, jaringan kalau belum. Yang lokal selalu
didahulukan — aturannya ada di [Unduhan manga](downloads.md). Posisi dan
statusnya sendiri tidak pernah butuh jaringan; itu ada di SQLite.

## User Flow

1. Halaman detail sebuah judul manga → ketuk baris chapter, atau tombol
   **Lanjut** yang menunjuk chapter belum dibaca paling awal.
2. Reader terbuka layar penuh tanpa nav. Menu atas/bawah tampil sebentar lalu
   menghilang sendiri.
3. **Mode gulir (bawaan):** gulir seperti halaman web biasa. Ketuk sepertiga
   atas/bawah untuk maju satu layar, tengah untuk memanggil menu.
4. **Mode halaman:** ketuk sisi kiri/kanan atau usap mendatar untuk berpindah
   halaman; cubit atau ketuk dua kali untuk memperbesar, lalu geser untuk
   melihat bagian lain. Papan ketik: `←`/`→`, `PageUp`/`PageDown`, spasi, `m`
   untuk menu, `Esc` untuk keluar.
5. Menu bawah berisi penggeser halaman dan tombol chapter sebelumnya/berikutnya.
   Menu atas berisi tombol keluar dan **setelan**.
6. Halaman terakhir tercapai → chapter otomatis bertanda sudah dibaca, dan
   Riwayat ikut terisi.
7. Keluar di tengah chapter → kembali ke halaman detail. Membukanya lagi
   melanjutkan di halaman yang sama.

## Data & Aturan

### Progres ditulis setiap halaman berganti, bukan saat keluar

Tidak ada tombol simpan dan tidak ada penyimpanan saat aplikasi ditutup: aplikasi
yang dibunuh sistem Android tidak pernah mendapat kesempatan itu. Setiap
perpindahan halaman memanggil `items.setProgress()` + `history.record()`. Karena
mode halaman dan mode gulir sama-sama lewat `goTo()` di store, aturan "halaman
terakhir = selesai" cuma hidup di satu tempat.

### "Selesai" berarti halaman terakhir terlihat

Bukan "digulir sampai piksel terakhir". Gambar terakhir sebuah webtoon bisa
setinggi tiga layar, dan memaksa penggunanya menggulir sampai ujung membuat
chapter yang jelas sudah dibaca tetap bertanda belum. Di mode gulir ini dijaga
sensor terpisah di dasar chapter, karena potongan terakhir sering lebih pendek
dari setengah layar dan tidak pernah melewati pita "sedang dibaca" di tengah.

### Chapter yang sudah tamat dibuka dari awal

`open()` melanjutkan di `last_position`, kecuali `seen = 1`. Membuka ulang
chapter yang sudah selesai hampir selalu berarti ingin membacanya ulang, bukan
melihat halaman terakhirnya.

### Halaman "sekarang" di mode gulir hanya bergeser kalau digulir

Posisi baca di mode gulir dibaca dari `IntersectionObserver` dengan `rootMargin`
`-45%` atas-bawah — pita tipis di tengah layar yang praktis cuma memuat satu
gambar. Menghitung `scrollTop` tiap frame memaksa layout dibaca ulang terus dan
membuat gulirnya tersendat justru di perangkat yang paling butuh mulus.

Dua penjaga menempel di situ, keduanya lahir dari bug sungguhan:

- **Selagi posisi dipulihkan, laporan pengamat diabaikan.** Melompat ke halaman
  20 melewati 1–19, dan masing-masing sempat melapor "sedang dibaca" — progresnya
  tertulis mundur.
- **Sebelum ada gulir sungguhan, tidak ada posisi baru yang ditulis.** Waktu
  gambar berdatangan, tinggi tiap potongan berubah dan pita tengah berpindah
  sendiri: chapter yang baru dibuka tercatat di halaman tiga tanpa satu pun jari
  menyentuh layar. Gambar yang belum dimuat juga diberi tinggi cadangan supaya
  tidak menumpuk pendek-pendek di pita yang sama.

### Preload berarti elemen, bukan `Image()` lepas

Mode halaman memasang halaman tetangga (satu sebelum, N sesudah) ke DOM dan cuma
menyembunyikannya. Menyiapkannya lewat objek `Image()` juga mengisi cache, tapi
elemen yang sama persis menjamin yang dipakai nanti memang yang sudah diambil.
Jumlahnya bisa disetel; makin banyak makin mulus, makin boros kuota.

### Arah baca membalik makna sisi layar, bukan urutan daftar

Halaman ke-3 tetap halaman ke-3 di mode kanan→kiri. Yang berubah cuma sisi mana
yang berarti "maju" — termasuk arah penggeser di menu bawah dan ikon panah
chapter.

### Gambar lewat resolver media, bukan URL mentah

`<img>` tidak bisa mengirim `Referer`, sedangkan CDN manga rutin menolak
permintaan tanpa itu. Karena itu tiap `SPage` dilewatkan `mediaUrl(imageUrl,
headers)`: di web jadi alamat proxy yang memasang headernya, di APK dipakai apa
adanya karena `CapacitorHttp` bebas melakukannya sendiri. Alamat yang isinya
sudah ada di perangkat (`blob:` halaman terunduh, `data:`, `capacitor:`)
dilewatkan tanpa disentuh — tidak ada yang bisa diambilkan proxy dari sana.

Gagalnya satu gambar tidak mematikan chapternya — halaman yang gagal punya tombol
**Coba lagi** sendiri, dan mencoba ulang cuma memasang ulang elemennya (`:key`),
tanpa menambah parameter ke URL yang akan mengubah alamat proxy dan membatalkan
cache-nya.

### Zoom dikerjakan sendiri

Zoom bawaan browser ikut memperbesar bilah menu dan tidak bisa dikembalikan ke 1×
waktu halaman berganti. Yang dipakai di sini `transform` pada elemen gambarnya
saja, lewat Pointer Events (jari, stylus, dan mouse satu jalan). Perbesaran
selalu kembali ke 1× tiap ganti halaman: kalau tidak, pembacanya mendarat di
potongan acak gambar berikutnya.

Ketukan tunggal ditunda 280 ms sebelum dijalankan. Tanpa jeda itu, ketukan
pertama sebuah ketukan-ganda sudah terlanjur mengganti halaman sebelum ketukan
kedua sempat dibaca sebagai perintah zoom.

### Setelan berlaku global

Mode, ukuran, jumlah preload, tap zone, layar penuh, dan orientasi disimpan
sebagai satu nilai JSON di tabel `setting` — jadi ikut terbawa backup di Fase 9.
Bukan per judul: pembaca manga cenderung punya satu kebiasaan, dan menyetel ulang
tiap membuka judul baru cuma merepotkan.

### Layar penuh dan orientasi boleh gagal

Keduanya menelan errornya. Browser menolak fullscreen yang tidak dipicu gestur
pengguna, dan kunci orientasi cuma nyata di APK (pluginnya di-`import()` dinamis
dan hanya di native, pola yang sama dengan driver database). Reader yang tidak
jadi layar penuh masih reader yang bisa dipakai; pengecualian yang dilempar ke
atas justru akan membatalkan pembukaan chapternya.

### Pindah chapter mengganti alamat, tidak menumpuknya

`router.replace()`, bukan `push()`. Kalau tidak, tombol kembali setelah membaca
sepuluh chapter berarti menelusuri sepuluh chapter itu mundur satu per satu
alih-alih kembali ke halaman judulnya.

## Yang sengaja belum ada

- **Halaman ganda (spread) di layar lebar.** Mode halaman selalu satu halaman.
- **Penanda halaman di dalam chapter.** Penanda masih setingkat chapter.

## Kode

| Path                                                | Fungsi                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/app/src/services/reader.service.ts`           | Konteks chapter dari DB, halaman dari berkas lokal atau source, progres     |
| `apps/app/src/services/screen.service.ts`           | Layar penuh (Fullscreen API) + kunci orientasi (native saja)                |
| `apps/app/src/stores/reader.ts`                     | Keadaan sesi baca; satu-satunya tempat aturan progres & "selesai"           |
| `apps/app/src/composables/useZoomPan.ts`            | Cubit/ketuk-ganda untuk zoom, geser, usapan, dan ketukan tunggal            |
| `apps/app/src/pages/reader/ReaderPage.vue`          | Penyambung store ⇄ tampilan ⇄ layar perangkat; papan ketik                  |
| `apps/app/src/components/reader/PagedView.vue`      | Mode halaman: preload, tap zone, usapan, zoom                               |
| `apps/app/src/components/reader/WebtoonView.vue`    | Mode gulir menerus: pelacakan halaman + sensor ujung chapter                |
| `apps/app/src/components/reader/ReaderImage.vue`    | Satu halaman: penanda muat, kegagalan yang bisa diulang sendiri             |
| `apps/app/src/components/reader/ReaderMenu.vue`     | Bilah atas/bawah: keluar, judul, penggeser halaman, lompat chapter          |
| `apps/app/src/components/reader/ReaderSettings.vue` | Panel setelan yang berlaku seketika                                         |
| `apps/app/src/components/entry/ItemRow.vue`         | Baris chapter; `openable` menentukan barisnya bisa dibuka atau tidak        |
| `apps/app/src/router/links.ts`                      | `readerLocation()` — pembentuk rute reader yang aman                        |
| `scripts/smoke.mjs`                                 | Smoke: buka chapter → maju → keluar → masuk lagi → habis → bertanda selesai |
