# Fitur: Tracker MAL/AniList

**Status:** ⏭️ Sengaja belum dikerjakan (direncanakan di Fase 9) · **Route:** —

## Kenapa dicatat kalau tidak ada

Roadmap Fase 9 menyebutnya "opsional". Fitur yang direncanakan lalu hilang tanpa
kabar akan dikira lupa, dan orang berikutnya mengulang penilaian yang sama dari
nol — jadi keputusannya ditulis di sini, bukan didiamkan.

## Yang dimaksud tracker

Menyambungkan library Mirai ke akun [MyAnimeList](https://myanimelist.net) atau
[AniList](https://anilist.co): judul yang dibaca/ditonton di Mirai ikut naik
progresnya di sana, lengkap dengan status (`reading`, `completed`) dan skor.

## Kenapa ditunda

| Hambatan                     | Isinya                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Butuh **client ID** OAuth    | Keduanya mewajibkan aplikasi didaftarkan atas nama seseorang; tidak ada kredensial yang bisa dibuat dari dalam repo ini          |
| Butuh **redirect URI** tetap | Web di `localhost` dan APK memakai skema berbeda; keduanya harus didaftarkan lebih dulu di dasbor masing-masing layanan          |
| Butuh **akun pihak ketiga**  | Tidak ada cara memverifikasinya tanpa akun sungguhan di kedua layanan — dan tanpa verifikasi, fiturnya cuma diklaim jalan        |
| Butuh **pencocokan judul**   | Judul di situs sumber jarang sama persis dengan judul di MAL/AniList; pencocokan otomatis meleset di sekuel dan judul alternatif |

Tiga yang pertama bukan soal kode: apa pun yang ditulis di sini tidak bisa diuji
di mesin pengembangan sampai kredensialnya ada. Menulisnya tanpa itu berarti
mengirim fitur yang tidak pernah sekali pun berhasil menyimpan satu progres.

## Yang sudah siap menerimanya

Kalau nanti dikerjakan, sambungannya sudah punya tempat:

- **Titik pengait progres** — `saveProgress()`/`markFinished()` di
  `reader.service.ts` dan `player.service.ts` adalah satu-satunya tempat progres
  bergerak. Tracker cukup menumpang di situ, bukan menyebar ke komponen.
- **Pencocokan yang dipilih manusia** — pola dialog di
  [migrasi.md](migrasi.md) persis masalah yang sama (mencocokkan satu judul ke
  judul di layanan lain), termasuk alasan kenapa manusia yang memilih.
- **Incognito** — gerbangnya sudah tunggal di `recordHistory()`, tapi tracker
  harus ikut dibungkam di titik pengaitnya sendiri; lihat [privasi.md](privasi.md).
  Mode privat yang tetap mengirim "sudah baca chapter 5" ke server luar adalah
  kebocoran yang jauh lebih buruk daripada baris riwayat lokal.
- **Backup** — daftar tautan tracker harus ikut di berkas ekspor, lihat
  [backup.md](backup.md).

## Kode

Belum ada.
