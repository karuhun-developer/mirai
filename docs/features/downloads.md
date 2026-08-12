# Fitur: Unduhan

**Status:** ✅ Selesai (Fase 6 chapter · Fase 7 episode) · **Route:** `/downloads`

## Tujuan

Menyimpan chapter dan episode ke perangkat supaya bisa dibaca dan ditonton
**tanpa internet sama sekali** — di kereta, di pesawat, atau di tempat yang
sinyalnya cukup untuk WhatsApp tapi tidak untuk mengunduh dua puluh gambar
berturut-turut, apalagi tiga ratus segmen video.

Dua janji yang dijaga fase ini:

1. Chapter atau episode yang bertanda terunduh **selalu** dibaca dari berkas di
   perangkat, bahkan waktu jaringannya sehat. Itulah gunanya mengunduh.
2. Antreannya selamat dari aplikasi yang ditutup. Unduhan yang terpotong
   dilanjutkan sendiri waktu aplikasi dibuka lagi, bukan diulang dari nol.

Chapter dan episode lewat antrean, halaman, dan tombol yang sama persis; yang
berbeda cuma isi pekerjaannya. Karena itu dokumen ini menaruh aturan bersamanya
lebih dulu, lalu yang khusus video di bagian [Episode anime](#episode-anime).

## User Flow

1. Halaman detail sebuah judul → tiap baris chapter atau episode punya tombol
   unduh di kanan. Ikonnya sekaligus keadaan barisnya: panah (belum), lingkaran
   berputar (sedang, dengan persennya di subjudul), centang (tersimpan),
   segitiga (gagal).
2. Mau sekaligus? Tombol **Unduh N** di kepala daftar mengantre semua yang belum
   tersimpan; tombol tong sampah di sebelahnya menghapus semua unduhan judul
   itu.
3. Halaman **Unduhan** menampilkan antrean beserta bilah progresnya, tombol
   **Jeda**/**Lanjutkan** untuk semuanya sekaligus, dan **Bersihkan yang
   selesai** untuk merapikan daftar tanpa menghapus berkasnya. Di atasnya
   muncul peringatan ruang penyimpanan begitu sisanya menipis.
4. Yang gagal tinggal di daftar dengan pesannya, lengkap dengan tombol ulangi.
5. Buka chapter yang sudah tersimpan → reader membacanya dari perangkat. Buka
   episode yang sudah tersimpan → pemutar memutarnya dari perangkat, dengan
   kualitas bertuliskan **Terunduh**. Jaringan boleh mati sepenuhnya.
6. **Pengaturan → Unduhan**: berapa chapter dikerjakan sekaligus (1–4), hapus
   otomatis setelah dibaca, berapa ruang yang sudah terpakai, dan peringatan
   yang sama waktu ruangnya menipis.

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

## Episode anime

### Kualitasnya dipilih aturan yang sama dengan menonton

`downloadEpisode()` memanggil `loadVideos()` milik `player.service`, bukan
menyalin logikanya. Daftar video satu episode ditentukan aturan yang sama untuk
menonton dan mengunduh — termasuk kualitas pilihan pengguna — dan dua salinan
aturan yang sama adalah dua aturan yang lambat laun berbeda.

Video bertipe `embed` dibuang lebih dulu: itu halaman pemutar pihak ketiga,
bukan berkas. Episode yang cuma punya `embed` ditolak dengan kalimatnya sendiri,
bukan dengan "gagal mengunduh" yang tidak menjelaskan apa-apa.

### Satu berkas atau ratusan segmen

- **mp4/mkv** turun sebagai satu berkas bernama `video.<ext>` lewat jalur yang
  sama dengan gambar manga. Progresnya dari byte yang sudah turun — tanpa itu,
  episode 300 MB berarti bilah yang membeku di nol selama beberapa menit dan
  terlihat seperti macet.
- **HLS** jauh lebih berbelit: playlist dibaca, dituliskan ulang, lalu seluruh
  isinya diunduh satu per satu.

Playlist master (`#EXT-X-STREAM-INF`) diselesaikan lebih dulu — variannya
dipilih dengan `pickVideo()` yang sama, jadi "720p" berarti hal yang sama di
pemutar dan di antrean. Master yang menunjuk master lagi ditolak, bukan
ditelusuri: bentuk itu tidak wajar, dan rantai tanpa ujung lebih buruk daripada
gagal yang jelas.

`planPlaylist()` menghasilkan dua hal sekaligus: **daftar sumber daya** yang
harus diunduh dan **teks playlist baru** yang sudah menyebut nama berkas lokal.
Penamaannya berpadding dan berurutan (`0001.ts`, `map-01.mp4`, `key-01.key`),
dan URL yang sama muncul dua kali cukup diunduh sekali.

### Playlist ditulis paling akhir

Keberadaannya karena itu berarti "seluruh segmennya sudah ada" — dan itulah yang
dibaca `localVideo()` untuk memutuskan sebuah episode siap diputar. Tanpa aturan
itu, unduhan yang terputus meninggalkan playlist utuh yang menunjuk ratusan
berkas yang belum turun, dan episodenya berhenti di tengah tanpa penjelasan.

Melanjutkan yang terputus memakai aturan yang sama dengan halaman manga — yang
sudah ada dilewati kecuali berkas terakhir — dengan satu tambahan: yang dihitung
cuma berkas yang **memang direncanakan**. Kalau tidak, takarir dari percobaan
sebelumnya bisa terpilih sebagai "berkas terakhir" dan membuat segmen yang
benar-benar separuh jadi lolos.

### AES-128: kuncinya ikut diunduh, bukan dipakai mendekripsi

Roadmap menyebut "dekripsi AES-128"; yang benar-benar dikerjakan sedikit
berbeda, dan lebih sederhana. Berkas kunci yang ditunjuk `#EXT-X-KEY` ikut
diunduh seperti segmen biasa, dan atribut `URI`-nya ditulis ulang ke nama lokal.
Segmennya tetap tersimpan dalam keadaan terenkripsi, dan yang mendekripsi nanti
**hls.js sendiri** waktu memutar — persis seperti waktu menonton dari jaringan.

Alasannya: mendekripsi sendiri berarti memuat tiap segmen ke memori, memanggil
WebCrypto, lalu menulis hasilnya — tiga kali kerja untuk sesuatu yang sudah
dikerjakan pemutarnya dengan benar, dan satu tempat baru yang bisa salah
menangani IV. Konsekuensinya jujur disebut di sini: **berkas hasil unduhan hanya
berguna di dalam aplikasi ini**, tidak bisa dibuka pemutar lain. Untuk sekarang
itu bukan kerugian, karena berkasnya memang tinggal di direktori privat
aplikasi.

Jalur AES-128 diuji lewat unit test `hlsPlaylist.test.ts`; smoke test memakai
HLS fMP4 tanpa enkripsi, karena yang perlu dibuktikan di sana adalah "utuh
diputar tanpa jaringan", bukan penulisan ulang tagnya.

### Takarir dikonversi sekarang, bukan nanti

Untuk sebagian besar orang yang menonton di sini, episode tanpa takarir sama
saja dengan episode yang tidak bisa ditonton — jadi takarir bukan pelengkap. Tiap
track diambil, dikonversi ke WebVTT lewat `toVtt()`, dan disimpan sebagai
`sub-01.vtt`. Konversinya dikerjakan saat mengunduh karena berkas VTT yang sudah
jadi bisa langsung dipasang ke `<track>` walau perangkatnya tanpa jaringan.

Labelnya ("English [Fansub]") tidak muat jadi nama berkas tanpa dirusak,
sementara pemilih takarir menampilkannya apa adanya — karena itu ada
`subtitles.json` yang memasangkan nama berkas dengan label dan bahasanya. Satu
takarir yang gagal tidak menggagalkan episodenya: video yang sudah turun ratusan
megabita tidak boleh dibuang gara-gara satu berkas teks.

### Memutarnya kembali: playlist dilokalkan di memori

Playlist yang tersimpan di perangkat menyebut segmennya dengan nama relatif.
Yang diserahkan ke pemutar adalah **salinannya di memori** yang alamatnya sudah
diubah jadi `mirai-local://<path>` absolut, dibungkus jadi `blob:`. Kenapa tidak
disimpan begitu saja dalam bentuk absolut: direktori episode ikut berubah kalau
judul atau nama episodenya berubah, dan playlist berisi alamat mutlak akan mati
diam-diam.

Skema `mirai-local://` tidak dikenal browser mana pun, dan memang tidak perlu:
yang membacanya `createLocalLoader` — loader hls.js yang membaca berkasnya lewat
`storage.service` alih-alih lewat jaringan. Ratusan segmen karena itu tidak
perlu jadi ratusan `blob:` yang menahan seluruh episode di memori sekaligus.

`resolveVideos()` mendahulukan lokal persis seperti `loadPages()` di reader,
lengkap dengan penyembuhan tanda yang basi: direktori yang ternyata kosong
menurunkan `downloaded` di tempat lalu videonya diambil dari jaringan seperti
biasa. Satu-satunya kualitas yang ditawarkan bernama **Terunduh** — dan label itu
sengaja tidak ikut tersimpan sebagai kualitas pilihan, sebab "Terunduh" bukan
kualitas dan menyimpannya berarti unduhan berikutnya kehilangan acuan.

### Ruang penyimpanan mulai jadi urusan aplikasi

Satu episode 24 menit berkisar 150–500 MB — kelas yang berbeda dari chapter
manga yang cuma beberapa megabita. Yang paling buruk bukan penolakan di depan,
melainkan episode separuh jadi yang memakan sisa ruang lalu tetap tidak bisa
diputar.

`storageStatus()` karena itu punya dua ambang, dan keduanya memakai persentase
**dan** angka mutlak sekaligus, diambil yang lebih besar: kuota browser bisa
ratusan gigabita (10% berarti puluhan GB, terlalu cerewet) atau cuma beberapa
ratus megabita di perangkat penuh (10% berarti tidak pernah memperingatkan apa
pun sampai benar-benar mentok).

| Keadaan | Ambang                | Akibatnya                                      |
| ------- | --------------------- | ---------------------------------------------- |
| `low`   | sisa ≤ 1 GB atau 10%  | Peringatan di halaman Unduhan dan Pengaturan   |
| `full`  | sisa ≤ 200 MB atau 3% | Pekerjaan berikutnya ditolak sebelum berangkat |

Kuota yang tidak diketahui (native, atau browser yang tidak mengabarkannya)
diperlakukan sebagai lega: menakut-nakuti tanpa angka lebih buruk daripada diam,
dan kegagalan menulis nanti tetap punya pesannya sendiri.

## Yang sengaja belum ada

- **Notifikasi progres di Android.** Tidak ikut Fase 8: notifikasi cuma masuk akal
  kalau antreannya tetap jalan waktu aplikasi ditutup, dan itu butuh foreground
  service. Keduanya satu paket pekerjaan — lihat [android.md](android.md).
- **Hapus otomatis waktu ruang menipis.** Yang ada baru peringatan dan penolakan
  berangkat; tidak ada yang membuang unduhan lama sendiri.
- **Hapus setelah ditonton.** Setelan itu baru berlaku untuk chapter; episode
  selalu menunggu dihapus manual.
- **DASH.** `SVideo` mengenal tipenya, tapi tidak ada yang menanganinya — di
  pemutar maupun di antrean ia diperlakukan sebagai berkas utuh, yang berarti
  cuma manifesnya yang turun. Belum ada extension yang mengembalikannya.
- **Unduh judul yang belum ada di library.** Antrean selalu berangkat dari
  daftar chapter atau episode sebuah judul.

## Kode

| Path                                                | Fungsi                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/app/src/services/download.service.ts`         | Antrean, pekerja, jeda/lanjut, chapter & episode, hapus, auto-hapus       |
| `apps/app/src/services/downloadPath.ts`             | Nama direktori & berkas: sidik jari id, padding nomor, ruas yang aman     |
| `apps/app/src/services/hlsPlaylist.ts`              | Baca master/media playlist, rencanakan nama lokal, tulis ulang playlist   |
| `apps/app/src/services/hlsLoader.ts`                | Loader hls.js: lewat proxy (jaringan) dan `mirai-local://` (perangkat)    |
| `apps/app/src/services/localMedia.ts`               | Membaca kembali yang terunduh: halaman, video, playlist, katalog takarir  |
| `apps/app/src/services/storageQuota.ts`             | Ambang `low`/`full` ruang penyimpanan beserta kalimat peringatannya       |
| `apps/app/src/services/subtitle.ts`                 | Konversi takarir ke WebVTT sebelum ditulis ke perangkat                   |
| `apps/app/src/services/player.service.ts`           | `resolveVideos()` mendahulukan berkas lokal, label kualitas "Terunduh"    |
| `apps/app/src/services/storage.service.ts`          | OPFS (web) vs plugin Filesystem (native), alamat berkas, kuota            |
| `apps/app/src/stores/downloads.ts`                  | Cermin reaktif antrean; penyegaran ber-throttle 400 ms                    |
| `apps/app/src/pages/downloads/DownloadsPage.vue`    | Daftar antrean, jeda/lanjutkan semua, bersihkan yang selesai              |
| `apps/app/src/components/downloads/DownloadRow.vue` | Satu pekerjaan: keadaan, progres, ulangi, buang                           |
| `apps/app/src/components/entry/ItemRow.vue`         | Tombol unduh per chapter/episode dengan empat keadaannya                  |
| `apps/app/src/pages/entry/EntryDetailPage.vue`      | Unduh massal + hapus seluruh unduhan judul                                |
| `apps/app/src/pages/settings/SettingsPage.vue`      | Concurrency, hapus setelah dibaca, pemakaian ruang                        |
| `apps/app/src/services/reader.service.ts`           | `loadPages()` mendahulukan lokal; `cleanupIfFinished()` saat reader tutup |
| `packages/db/src/repositories/downloads.ts`         | Tabel `download`: antre, ambil berikutnya, requeue, progres, hapus        |
| `apps/app/test/downloadPath.test.ts`                | Unit test aturan penamaan berkas                                          |
| `apps/app/test/hlsPlaylist.test.ts`                 | Unit test master/media playlist, `#EXT-X-KEY`, `#EXT-X-MAP`, pelokalan    |
| `apps/app/test/hlsLoader.test.ts`                   | Unit test loader: alamat asli dilaporkan balik, berkas lokal terbaca      |
| `apps/app/test/storageQuota.test.ts`                | Unit test ambang ruang penyimpanan                                        |
| `scripts/smoke.mjs`                                 | Smoke: unduh 3 chapter & 1 episode HLS → putus jaringan → terbaca penuh   |
