# Fitur: Backup & Restore

**Status:** ✅ Selesai (Fase 9) · **Route:** `/settings` → bagian **Backup**

## Tujuan

Memindahkan seluruh isi Mirai ke perangkat lain, dan menyelamatkannya dari
perangkat yang hilang, lewat satu berkas JSON yang bisa disimpan di mana saja.

Yang dilindungi adalah data yang **tidak bisa didapat ulang dari mana pun**:
judul yang dipilih masuk library, kategorinya, sudah baca sampai mana, dan
riwayat. Chapter dan episode bisa diunduh lagi; daftar chapter datang lagi
sendiri dari sumbernya. Yang tidak bisa dibuat ulang cuma pilihan penggunanya.

## User Flow

1. **Pengaturan → Backup → Buat backup.** Di web berkasnya langsung terunduh; di
   APK muncul lembar "Bagikan" — pengguna yang memilih mau disimpan ke Drive,
   dikirim ke diri sendiri, atau ditaruh di Files. Namanya bertanggal
   (`mirai-backup-2026-08-13.json`) supaya beberapa backup bisa hidup
   berdampingan di satu folder.
2. **Pulihkan dari berkas** membuka pemilih berkas. Berkasnya **dibaca dulu, tidak
   langsung ditulis**: yang muncul adalah tanggal pembuatannya dan isinya dalam
   angka — berapa judul, kategori, chapter/episode, riwayat, extension.
3. **Pulihkan sekarang** menuliskannya. Setelah selesai, library dan daftar
   extension dibaca ulang di tempat, tanpa memuat ulang aplikasi.
4. Extension yang belum ada di perangkat ini ikut terpasang — bundelnya diunduh
   dari repo asalnya, jadi langkah ini butuh internet. Yang gagal dipasang tidak
   membatalkan restore; library-nya tetap masuk.

## Data & Aturan

### Apa yang ikut

| Sumber | Ikut | Tidak ikut |
|---|---|---|
| SQLite | `entry` (favorit + yang punya riwayat), `category`, `entry_category`, `item` (yang punya keadaan pengguna), `history`, `setting` | `download`, `entry`/`item` sisa penjelajahan katalog |
| `localStorage` | daftar repo, extension terpasang, setelan tiap paket, saklar NSFW | `mirai.settings` (User-Agent) |
| Berkas | — | seluruh isi unduhan, bundel kode extension |

Tiga keputusan yang perlu alasannya:

- **Bukan seluruh tabel.** `entry` dan `item` juga menampung residu penjelajahan
  — judul yang cuma sempat dilihat sekali dan daftar chapter lengkap tiap judul
  yang pernah dibuka. Membawa semuanya bisa melipatgandakan ukuran berkas tanpa
  menyelamatkan satu pun hal yang benar-benar hilang. Saringannya: entri yang
  difavoritkan atau punya riwayat; item yang sudah dibaca, punya posisi,
  ditandai, atau punya riwayat.
- **`download` tidak ikut sama sekali.** Isinya menunjuk direktori di perangkat
  ini. Di perangkat lain barisnya akan mengaku punya berkas yang tidak ada, dan
  reader akan membuka direktori kosong. Karena itu kolom `item.downloaded` juga
  dipaksa `0` saat masuk.
- **User-Agent milik perangkat, bukan milik pengguna.** Izin hasil verifikasi
  Cloudflare terikat ke User-Agent yang menyelesaikannya (lihat
  [cloudflare.md](cloudflare.md)); membawa UA perangkat lain justru merusak
  cookie yang sudah sah di sini.

### Restore menggabung, tidak pernah mengosongkan

Restore paling sering dipakai untuk memindahkan library ke perangkat kedua yang
**sudah berisi sesuatu**. Impor yang diam-diam menghapus adalah cara tercepat
kehilangan data yang tidak ada backup-nya, jadi tidak ada satu baris pun yang
dibuang: yang bentrok dimenangkan berkas backup, sisanya tetap tinggal.

Aturan yang mengikuti dari situ:

- Seluruh penulisan database ada di **satu transaksi**. Backup yang gagal di
  tengah tidak boleh meninggalkan setengah library beserta riwayat menggantung.
- Perintahnya `INSERT … ON CONFLICT DO UPDATE`, **bukan** `INSERT OR REPLACE`.
  REPLACE menghapus baris lama lebih dulu, dan penghapusan itu memicu
  `ON DELETE CASCADE` — mengganti satu entri akan ikut membuang seluruh chapter
  dan riwayatnya, termasuk yang baru saja dimasukkan.
- Urutannya mengikuti foreign key (kategori → entri → penghubung → item →
  riwayat → setelan), dan FK memang menyala di kedua driver.
- Baris yang salah satu sisinya tidak terbawa dibuang diam-diam. Alternatifnya
  adalah seluruh restore gagal gara-gara satu kategori yang hilang di berkas
  backup yang sudah tua.
- Setelan extension digabung per kunci, jadi domain alternatif yang baru dipilih
  di perangkat ini tidak ikut hilang.
- Saklar NSFW cuma dinyalakan, tidak pernah dimatikan.

### Membaca berkas dari luar

Berkas backup adalah satu-satunya masukan di Mirai yang boleh menulis ke seluruh
tabel sekaligus, jadi pembacaannya **memaafkan bagian yang hilang** tapi
**menolak berkas yang salah**:

| Keadaan | Hasil |
|---|---|
| Bukan JSON | Ditolak: "Berkasnya bukan JSON yang sah." |
| JSON tapi bukan backup Mirai (`format` beda) | Ditolak: "Berkas ini bukan backup Mirai." |
| `version` lebih besar dari yang dikenal | Ditolak, dengan saran memperbarui aplikasi |
| Tabel atau bagian yang belum ada di versi lama | Dianggap kosong |
| Extension tanpa `entry.file` | Dibuang — tidak ada yang tahu berkas mana yang harus diunduh |

`BACKUP_VERSION` adalah versi **format**, bukan versi aplikasi. Naik hanya kalau
berkas lama tidak lagi bisa dibaca apa adanya; menambah bidang baru yang boleh
kosong tidak menaikkannya — itu yang membuat backup dari versi lama tetap bisa
dipulihkan setahun kemudian.

## Kode

| Path | Isi |
|---|---|
| `packages/db/src/repositories/backup.ts` | `BackupRepository.dump()` / `.restore()`, saringan entri & item, `upsert()` |
| `apps/app/src/services/backupFormat.ts` | Bentuk berkas, `parseBackup()`, `backupFileName()`, `summarize()` — murni, tanpa I/O |
| `apps/app/src/services/backup.service.ts` | `createBackup()`, `exportBackup()`, `readBackup()`, `applyBackup()`; Share di native, unduhan biasa di web |
| `apps/app/src/stores/backup.ts` | State tombol, berkas yang menunggu konfirmasi, muat ulang library + extension setelah restore |
| `apps/app/src/pages/settings/SettingsPage.vue` | Bagian **Backup** |
| `apps/app/test/backupFormat.test.ts` | Uji pembacaan berkas: rusak, asing, versi lebih baru, bagian hilang |

Lapisannya tetap satu arah. `backup.service.ts` tidak boleh memanggil store —
memasang ulang extension berarti mengunduh bundel dan menghidupkan Worker, dan
itu urusan `stores/extensions.ts`. Karena itu `applyBackup()` mengembalikan
daftar extension yang perlu dipasang, dan store yang mengerjakannya.

## Yang belum terverifikasi

- Ekspor di APK (lembar Bagikan lewat `@capacitor/share`) belum pernah dijalankan
  di perangkat sungguhan — lihat [android.md](android.md) untuk daftar lengkap
  yang menunggu APK pertama.
- Backup berukuran besar (ribuan entri) belum diukur. Seluruh berkas dibaca ke
  memori sebagai satu string JSON; kalau nanti jadi masalah, jalan keluarnya
  memecah per tabel, bukan mengubah formatnya.
