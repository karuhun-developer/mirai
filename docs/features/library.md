# Fitur: Library offline-first

**Status:** ✅ Selesai (Fase 3) · **Route:** `/library/:kind` ·
`/entry/:kind/:sourceId/:url` · `/updates` · `/history`

## Tujuan

Membuat koleksi pengguna hidup di perangkatnya sendiri. Judul yang sudah
difavoritkan, kategorinya, progres bacanya, dan riwayatnya harus tetap tampil
utuh saat jaringan mati dan tetap ada setelah aplikasi dimuat ulang — situs
sumber cuma dibutuhkan untuk hal yang memang baru: chapter baru, sinopsis yang
berubah, halaman yang dibaca.

Batasnya jelas dan disengaja: **membaca dan menonton tetap butuh internet**
sampai unduhan hadir di Fase 6–7. Yang dijanjikan offline di fase ini adalah
daftar, bukan isinya.

## User Flow

1. **Browse** → satu sumber → hasil populer/pencarian muncul. Tanpa disadari,
   tiap hasil sudah disimpan sebagai baris `entry`.
2. Ketuk sebuah kartu → **halaman detail**. Judul dan cover langsung tampil dari
   database; sinopsis dan daftar chapter menyusul dari sumber.
3. **Tambah ke library** → judulnya masuk ke tab Manga/Anime. Kalau daftar
   chapternya belum pernah diambil, saat itu juga diambil sekali.
4. **Kategori** → pilih kategori mana saja yang memuat judul ini; tab di Library
   ikut bertambah.
5. Ikon centang di baris chapter menandainya sudah dibaca — dan mengisi
   **Riwayat**. Ikon panah-ganda menandai semua chapter sampai baris itu.
6. **Updates** → tombol muat ulang memeriksa satu per satu judul di library;
   chapter yang muncul setelah judulnya masuk library terkumpul di sini.
7. Matikan jaringan, muat ulang aplikasi → Library, tab kategori, dan Riwayat
   tetap tampil apa adanya.

## Data & Aturan

### Katalog pun ikut tersimpan

Membuka Browse menulis hasilnya ke tabel `entry` (`rememberCatalogue`), bukan
cuma menaruhnya di memori. Itulah yang membuat halaman detail tidak pernah mulai
dari kosong dan tautan langsung ke sebuah judul tetap bisa dibuka. Baris yang
cuma dilirik dan tidak difavoritkan dibersihkan `pruneOrphans()`.

Konsekuensinya: jumlah baris `entry` jauh lebih besar dari isi library, dan itu
memang wajar.

### Penyegaran tidak pernah menimpa progres

`upsert()` menerima daftar kolom yang boleh ditimpa — hanya kolom milik sumber
(judul, cover, sinopsis, nama chapter, nomor, tanggal). `favorite`, `seen`,
`last_position`, `bookmark`, dan `downloaded` tidak pernah ada di daftar itu.
Menjelajah katalog karena itu aman: judul yang sedang dibaca setengah jalan
tidak berubah statusnya cuma karena muncul lagi di halaman populer.

Item yang **hilang** dari sumber juga tidak dihapus. Situs kerap menyembunyikan
chapter sementara; menghapusnya berarti kehilangan progres baca beserta berkas
yang sudah diunduh.

### Batch pertama bukan update

Halaman Updates menyaring `item.added_at > entry.added_at`. Sinkronisasi pertama
sebuah entri memberi seluruh itemnya `added_at` yang sama persis dengan entrinya,
jadi menambahkan judul berisi 300 chapter tidak menenggelamkan daftar update.
Sinkronisasi berikutnya dijamin memakai nilai yang benar-benar lebih besar,
supaya entri yang difavoritkan lalu langsung disegarkan tidak kehilangan
chapter barunya karena kebetulan berada di milidetik yang sama.

### Penyegaran library berjalan berurutan

`refreshLibrary()` memeriksa judul satu demi satu, bukan serentak. Library berisi
200 judul akan menumpuk 200 panggilan Worker sekaligus, membuat tombol **Batal**
tidak berarti apa-apa, dan membuat situs sumber melihat lonjakan permintaan dari
satu pengguna. Yang ditukar: durasi. Yang didapat: proses yang bisa dilihat
kemajuannya dan dihentikan di tengah jalan.

Membuka halaman Updates **tidak** otomatis menyegarkan. Aplikasi yang baru dibuka
di data seluler tidak boleh langsung menembak puluhan situs sumber tanpa diminta.

Extension yang tidak terpasang tidak dianggap gagal; judulnya masuk daftar
`skipped` di laporan, terpisah dari `failures`.

### Kategori

Kategori terikat pada jenis (`anime`/`manga`) dan berupa relasi banyak-ke-banyak.
Menghapus kategori **tidak** menghapus judul di dalamnya — foreign key cuma
membuang baris keanggotaannya.

Tab hanya muncul kalau kategori memang dipakai. Dua nilai khusus, `all` dan
`none`, dipakai sebagai pilihan tab; keduanya aman berdampingan dengan id
kategori yang selalu 32 karakter heksadesimal.

Angka di tiap tab dihitung dari query **tanpa saringan**. Menyalakan "ada yang
belum dibaca" menyaring grid, bukan mengubah jumlah anggota kategori.

### Riwayat sebelum ada reader

Sampai reader hadir di Fase 4, menandai chapter "sudah dibaca" adalah
satu-satunya peristiwa "saya baca ini" yang ada — jadi itulah yang mengisi
`history`, dan membatalkan tandanya menghapus barisnya lagi. Begitu reader
mencatat posisi sungguhan, aturan ini tetap benar dan tinggal ditambahi.

### Cache cover

Cover disimpan di Cache API (`mirai-covers-v1`) dengan kunci **URL sumber**,
bukan URL proxy: alamat proxy berbeda antara web dan APK, sedangkan alamat
aslinya tidak — cache jadi ikut pindah, bukan dingin lagi setiap ganti target
build. Isinya dibatasi 600 entri; yang terlama dibuang lebih dulu.

`useCover()` yang memegang daur hidup `blob:` URL: dibebaskan saat sumbernya
berganti dan saat komponennya mati, dan hasil yang telat datang dibuang kalau
sumbernya sudah berubah. Di konteks tanpa `caches` (HTTP non-lokal) cache
dilewati diam-diam dan gambarnya tetap tampil.

### Setelan yang bertahan

Pengurutan, arah, saringan, dan kategori yang sedang dibuka disimpan di tabel
`setting`, bukan di `localStorage`. Alasannya satu: semua yang ada di SQLite ikut
terbawa saat backup/restore di Fase 9.

### Rute entri

URL sumber mengandung garis miring, jadi rutenya `:url(.*)` dan lokasinya selalu
dibentuk sebagai objek lewat `entryLocation()`. Menyusun path sebagai teks
membuat `%2F` ter-encode dua kali dan judulnya tidak pernah ketemu.

## Yang sengaja belum ada

- **Tombol Lanjut** di halaman detail sudah tampil beserta nama chapter/episode
  berikutnya, tapi dinonaktifkan — reader dan player baru hadir di Fase 4–5.
  Menautkannya ke rute yang belum ada lebih buruk daripada tombol mati yang
  menjelaskan dirinya sendiri.
- **Saringan "sudah diunduh"** sudah jalan sampai ke SQL, tapi kolom `downloaded`
  baru akan terisi di Fase 6.
- **Penyegaran latar belakang terjadwal** belum ada; penyegaran selalu dimulai
  pengguna.
- Tabel `download` sudah ada di skema tapi belum punya repository — dibuka di
  Fase 6, bukan sekarang.

## Kode

| Path                                                 | Fungsi                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/db/`                                       | Skema, migrasi, driver native/web, repository (satu-satunya SQL)               |
| `apps/app/src/services/db.service.ts`                | Membuka koneksi saat boot, menyimpan instance repository, `window.__db` di dev |
| `apps/app/src/services/library.service.ts`           | Terjemahan maunya UI jadi `LibraryQuery`; kategori; setelan tampilan           |
| `apps/app/src/services/entry.service.ts`             | Muat detail, simpan hasil katalog, favorit, tandai dibaca                      |
| `apps/app/src/services/updates.service.ts`           | Penyegaran berurutan dengan progres, batal, dan laporan                        |
| `apps/app/src/services/history.service.ts`           | Riwayat: daftar, hapus satu, hapus semua                                       |
| `apps/app/src/services/cover.service.ts`             | Cache cover (Cache API) berkunci URL sumber + batas 600 entri                  |
| `apps/app/src/composables/useCover.ts`               | Daur hidup `blob:` URL cover per komponen                                      |
| `apps/app/src/stores/library.ts`                     | Keadaan halaman Library: tab, saringan, pencarian                              |
| `apps/app/src/stores/entry.ts`                       | Keadaan halaman detail: SQLite dulu, jaringan menyusul                         |
| `apps/app/src/stores/updates.ts`                     | Daftar update + proses penyegaran yang bisa dibatalkan                         |
| `apps/app/src/stores/history.ts`                     | Keadaan halaman Riwayat                                                        |
| `apps/app/src/pages/library/LibraryPage.vue`         | Grid, tab kategori, pencarian, panel saringan                                  |
| `apps/app/src/pages/entry/EntryDetailPage.vue`       | Detail entri + daftar chapter/episode                                          |
| `apps/app/src/pages/updates/UpdatesPage.vue`         | Daftar update + progres penyegaran                                             |
| `apps/app/src/pages/history/HistoryPage.vue`         | Riwayat baca/tonton                                                            |
| `apps/app/src/components/entry/grid.ts`              | Bentuk kartu grid dari `SEntry`/`LibraryEntry`/`EntryRow`                      |
| `apps/app/src/components/entry/EntryCard.vue`        | Kartu cover + badge belum dibaca/unduhan/favorit                               |
| `apps/app/src/components/entry/ItemRow.vue`          | Baris chapter/episode beserta aksinya                                          |
| `apps/app/src/components/entry/ItemLine.vue`         | Baris untuk Updates dan Riwayat                                                |
| `apps/app/src/components/entry/CategoryPicker.vue`   | Pilih kategori untuk satu entri                                                |
| `apps/app/src/components/library/CategoryTabs.vue`   | Tab kategori yang bisa digulir mendatar                                        |
| `apps/app/src/components/library/LibraryFilters.vue` | Urutan, saringan, dan pengelolaan kategori                                     |
| `apps/app/src/router/links.ts`                       | `entryLocation()` — pembentuk rute entri yang aman                             |
| `scripts/smoke.mjs`                                  | Smoke: favorit → tandai dibaca → reload tanpa jaringan sumber                  |
