# Fitur: Migrasi Antar-Source

**Status:** ✅ Selesai (Fase 9) · **Route:** `/entry/:kind/:sourceId/:url` → tombol
**Migrasi**

## Tujuan

Memindahkan satu judul dari satu source ke source lain **tanpa kehilangan
jejaknya**.

Source mati, pindah domain, kualitas terjemahannya memburuk, atau chapternya
berhenti di tengah — itu kejadian biasa, dan judulnya sendiri selalu bisa dicari
lagi di tempat lain. Yang tidak bisa dibuat ulang adalah apa yang menempel
padanya: sudah baca sampai chapter berapa, halaman terakhirnya, penanda,
kategori, dan kapan terakhir dibuka. Tanpa migrasi, pindah source berarti memulai
judul dari nol dan berpura-pura belum pernah membacanya.

## User Flow

1. Buka judulnya di library → **Migrasi**. Tombolnya cuma muncul untuk judul yang
   ada di library: memindahkan judul yang belum difavoritkan tidak memindahkan
   apa pun.
2. Kotak pencarian sudah terisi judul aslinya. Di bawahnya deretan source lain
   yang **sejenis** — anime ke anime, manga ke manga; source asalnya sendiri
   tidak ada di daftar.
3. Pilih source tujuan → hasil pencariannya muncul beserta sampul. **Manusia yang
   memilih**, bukan aplikasi: mencocokkan judul lintas situs selalu meleset di
   sekuel, spin-off, dan judul alternatif, dan yang dipertaruhkan adalah progres
   baca berbulan-bulan.
4. Setelah satu kandidat dipilih, muncul saklar **Hapus judul yang lama**
   (menyala secara bawaan) dan peringatan bahwa berkas unduhan tidak ikut pindah.
5. **Pindahkan** → halaman langsung berpindah ke judul yang baru. Navigasinya
   `replace`, bukan `push`: tombol kembali tidak boleh mengantar orang ke judul
   yang barusan dihapusnya.

Kalau source tujuan menampilkan tantangan Cloudflare, kartunya muncul di dalam
dialog — sama perlakuannya dengan halaman Browse, lihat
[cloudflare.md](cloudflare.md).

## Data & Aturan

### Yang pindah, yang tidak

| Ikut pindah                                | Tidak ikut                                  |
| ------------------------------------------ | ------------------------------------------- |
| Status sudah dibaca/ditonton               | Berkas unduhan                              |
| Posisi terakhir (halaman/detik) + totalnya | Tanda `downloaded`                          |
| Penanda (bookmark)                         | Item yang nomornya tidak ada di source baru |
| Kategori + status favorit                  | Item yang tidak punya nomor sama sekali     |
| Riwayat, **dengan `read_at` aslinya**      |                                             |

Alasan berkas unduhan tidak ikut: chapter di source baru halamannya berbeda —
beda scanlator, beda pemotongan, kadang beda jumlah halaman. Menautkan berkas
lama ke item baru berarti menampilkan halaman yang salah dengan penuh keyakinan.
Lebih jujur menyuruh mengunduh ulang.

Alasan `read_at` dipertahankan: migrasi bukan peristiwa membaca. Menstempel ulang
seluruh chapter dengan jam sekarang akan melempar judul yang terakhir dibuka
setahun lalu ke puncak daftar Riwayat.

### Pencocokan chapter

Dicocokkan lewat **nomor**, tidak pernah lewat judul atau urutan:

- Judul chapter berbeda di tiap situs (`Chapter 12`, `Ch. 12 - Pulang`, `12`),
  sementara nomornya satu-satunya yang disepakati semua sumber.
- Menebak lewat urutan meleset satu langkah begitu salah satu source melewatkan
  sebuah chapter — dan melesetnya tidak terlihat sampai seseorang membuka chapter
  yang salah.
- Item tanpa nomor tidak dicocokkan sama sekali.
- Item yang belum pernah disentuh (belum dibaca, posisi 0, tanpa penanda) juga
  dilewati: tidak ada yang perlu dipindahkan.
- Kalau source baru punya nomor kembar (rilis ganda dari scanlator berbeda), yang
  teratas di daftarnya yang dipakai.

Aturannya diuji terpisah di `apps/app/test/migrateMatch.test.ts` — inilah bagian
yang bisa salah dengan cara yang sunyi, jadi ia sengaja bisa diuji tanpa
database, tanpa extension, dan tanpa jaringan.

### Urutan penulisan

Entri baru disiapkan **lengkap** lebih dulu (baris, detail, daftar chapter,
progres, kategori, favorit); entri lama baru disentuh di langkah terakhir.
Kegagalan di tengah jalan — jaringan mati waktu mengambil daftar chapter —
menyisakan dua judul di library, bukan nol.

Kalau **Hapus judul yang lama** dimatikan, entri lama cuma dicabut favoritnya:
progres dan riwayatnya tetap di sana sebagai jalan pulang kalau source barunya
ternyata lebih buruk.

## Kode

| Berkas                                               | Isinya                                                    |
| ---------------------------------------------------- | --------------------------------------------------------- |
| `apps/app/src/services/migrate.service.ts`           | Pencarian kandidat + seluruh urutan migrasi               |
| `apps/app/src/services/migrateMatch.ts`              | `pairByNumber()` — aturan pencocokan, murni & teruji      |
| `apps/app/src/stores/migrate.ts`                     | Keadaan dialog: kandidat, source tujuan, error, tantangan |
| `apps/app/src/components/entry/MigrateDialog.vue`    | Dialognya: source → pencarian → pilihan → konfirmasi      |
| `apps/app/src/components/entry/MigrateCandidate.vue` | Satu hasil pencarian beserta sampulnya                    |
| `apps/app/src/pages/entry/EntryDetailPage.vue`       | Tombol **Migrasi** + perpindahan halaman setelah selesai  |
| `packages/db/src/repositories/items.ts`              | `transferState()` — satu transaksi untuk seluruh daftar   |
| `packages/db/src/repositories/history.ts`            | `transfer()` — jejak baca pindah dengan `read_at` aslinya |
