# Fitur: Mode Incognito

**Status:** ✅ Selesai (Fase 9) · **Route:** `/settings` → bagian **Privasi**

## Tujuan

Membaca atau menonton sesuatu tanpa meninggalkan jejak di perangkat ini —
tanpa harus menghapus riwayat setelahnya, dan tanpa mengorbankan riwayat yang
sudah ada.

## User Flow

1. **Pengaturan → Mode incognito** dinyalakan.
2. Penanda kecil muncul di header selama mode itu menyala, di semua halaman.
   Menyentuhnya membuka Pengaturan.
3. Membaca dan menonton berjalan seperti biasa, tapi tidak ada yang dicatat:
   riwayat tidak bertambah, dan posisi terakhir tidak ikut tersimpan.
4. Mode ini **mati sendiri** setiap aplikasi ditutup.

## Data & Aturan

### Apa yang dibungkam

| Peristiwa                            | Incognito menyala                            |
| ------------------------------------ | -------------------------------------------- |
| Membuka halaman/menit berikutnya     | Posisi tidak disimpan, riwayat tidak ditulis |
| Chapter/episode selesai              | Tidak ditandai selesai                       |
| Tombol "tandai sudah dibaca"         | **Tetap menandai**, tanpa menulis riwayat    |
| Menambah judul ke library, mengunduh | Berjalan normal                              |
| Riwayat yang sudah ada sebelumnya    | Tidak dihapus, tidak disembunyikan           |

Yang eksplisit tetap dijalankan. Menandai chapter sudah dibaca adalah perintah,
bukan jejak yang tertinggal — membatalkannya diam-diam berarti tombol yang tidak
melakukan apa pun.

### Progres ikut ditahan, bukan cuma riwayat

Posisi baca yang tetap tersimpan sama saja memberi tahu siapa pun yang membuka
daftar chapter bahwa judul ini dibaca sampai halaman sekian. Bagi fitur yang ada
justru untuk itu, menyimpan setengahnya bukan kompromi — itu kebocoran.

Konsekuensinya jujur: membuka ulang chapter yang sama selama incognito dimulai
dari halaman pertama.

### Satu gerbang, bukan pemeriksaan di tiap pemanggil

Riwayat ditulis dari reader, pemutar, dan tombol "tandai sudah dibaca". Kalau
tiap pemanggil memeriksa sendiri, satu yang lupa berarti mode privatnya bocor
tanpa ada yang menyadari — jadi gerbangnya duduk di `recordHistory()`. Perilaku
gerbang itu diuji di `apps/app/test/incognito.test.ts`.

### Tidak ikut tersimpan ke `localStorage`

Sengaja. Mode privat yang bertahan lintas sesi berarti berhari-hari riwayat
hilang tanpa ada yang menyadarinya; matinya-sendiri lebih aman daripada
tersimpannya.

## Kode

| Berkas                                         | Isinya                                                |
| ---------------------------------------------- | ----------------------------------------------------- |
| `apps/app/src/services/settings.service.ts`    | `settings.incognito`; dikecualikan dari penyimpanan   |
| `apps/app/src/services/history.service.ts`     | `recordHistory()` — gerbangnya                        |
| `apps/app/src/services/reader.service.ts`      | `saveProgress()`/`markFinished()` berhenti lebih awal |
| `apps/app/src/services/player.service.ts`      | `saveProgress()`/`markWatched()` berhenti lebih awal  |
| `apps/app/src/services/entry.service.ts`       | Aksi manual tetap jalan, jejaknya yang ditahan        |
| `apps/app/src/components/layout/AppHeader.vue` | Penanda selama mode menyala                           |
| `apps/app/src/pages/settings/SettingsPage.vue` | Saklarnya                                             |
