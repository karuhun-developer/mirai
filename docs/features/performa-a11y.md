# Fitur: Performa Daftar Besar & Aksesibilitas

**Status:** ✅ Selesai (Fase 9) · **Route:** seluruh aplikasi

## Tujuan

Menjaga Mirai tetap ringan waktu isinya menumpuk — library ribuan judul, daftar
chapter judul yang sudah jalan sepuluh tahun — dan bisa dipakai tanpa tetikus
maupun tanpa melihat layar.

## User Flow

Tidak ada tombol baru. Yang berubah cuma terasa:

1. Membuka library besar atau judul dengan seribu chapter tidak lagi menahan
   layar beberapa detik sebelum bisa digulung.
2. Menekan **Tab** di halaman mana pun memunculkan tautan **Lompat ke konten**
   sebagai fokus pertama; menekan Enter memindahkan fokus ke isi halaman,
   melewati navigasi.
3. Pesan kegagalan dan kabar "sedang menyegarkan" ikut dibacakan pembaca layar,
   bukan cuma muncul di layar.
4. Yang menyalakan **kurangi gerak** di sistemnya tidak lagi melihat animasi.

## Data & Aturan

### Yang dirender cuma yang terlihat

Berlaku di dua tempat terpanjang: grid library/browse dan daftar chapter/episode
di halaman judul.

| Yang diukur                | Sebelum     | Sesudah  |
| -------------------------- | ----------- | -------- |
| 400 judul di grid (1440px) | 400 kartu   | 56 kartu |
| 1.000 chapter di daftar    | 1.000 baris | 20 baris |
| Tinggi dokumen             | 53.409px    | 53.409px |

Tinggi dokumen sengaja tidak berubah: scrollbar yang menyusut sewaktu digulung
adalah cara membuat daftar panjang mustahil dinavigasi.

Tiap kartu menahan satu blob cover di memori dan tiap baris chapter punya empat
tombol beserta pengamat unduhannya — itu dua hal yang harganya menumpuk, bukan
sekadar jumlah node.

**Padding, bukan elemen kosong.** Baris yang dilewati diganti `padding-top` dan
`padding-bottom` pada elemen daftarnya sendiri. Spacer berupa `div` tidak bisa
dipakai di grid: anak langsung sebuah CSS grid ikut menempati kolom, jadi
spacer-nya akan tampak sebagai kartu kosong di tengah grid.

**Diukur, bukan ditebak.** Jumlah kolom dibaca dari `grid-template-columns` yang
sudah diselesaikan browser, dan tinggi baris dari baris yang sungguh dirender.
Menghitungnya dari rasio kartu meleset beberapa piksel karena judul dua baris
dan pembulatan grid — dan melesetnya menumpuk sepanjang ribuan baris sampai
scrollbar berbohong.

**Elemennya diamati, bukan diukur sekali.** Daftar dan grid duduk di balik
`v-if` yang menunggu datanya dimuat, jadi saat komponennya di-mount elemennya
belum ada. Versi pertama mengukur di `onMounted` dan mencatat tinggi layar nol
selamanya: yang tampil cuma tiga baris pertama sampai orangnya menggulung.

**Di bawah 60 item semuanya dirender.** Daftar pendek tidak memberi keuntungan
apa pun, sementara harganya nyata: pencarian bawaan browser (Ctrl+F) tidak
menemukan baris yang tidak ada di DOM.

### Aksesibilitas

| Yang ditambahkan                       | Kenapa                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Tautan **Lompat ke konten**            | Tanpa itu papan ketik melewati tujuh tautan navigasi yang sama di tiap halaman |
| `tabindex="-1"` di `<main>`            | Sebagian browser cuma menggulung tanpa memindahkan fokus                       |
| `role="alert"` di pesan kegagalan      | Kegagalan yang muncul diam-diam di layar tidak sampai ke yang tidak melihatnya |
| `role="status"` di kemajuan penyegaran | Satu-satunya kabar bahwa app sedang bekerja tadinya cuma ikon berputar         |
| `prefers-reduced-motion`               | Animasi memicu pusing dan mual, bukan sekadar soal selera                      |

Durasi animasi dipangkas jadi hampir nol, **bukan** dimatikan: transisi yang
dihapus sepenuhnya membuat kode yang menunggu `transitionend` menggantung
selamanya.

Yang sudah ada sejak fase-fase sebelumnya dan sengaja tidak diubah: tiap tombol
berikon punya `aria-label`, nav punya `aria-current="page"`, gambar cover
memakai judulnya sebagai `alt`, dan `<html lang>` ikut berganti bersama bahasa
antarmuka (lihat [i18n.md](i18n.md)).

### Yang diperiksa mesin

`scripts/smoke.mjs` memakai selektor beraksesibilitas (`getByRole`) di browser
sungguhan, jadi tombol yang kehilangan namanya membuat smoke gagal, bukan lolos
diam-diam. Context Playwright-nya dipatok ke `id-ID` — tanpa setelan tersimpan
Mirai mengikuti bahasa perangkat, dan Chromium bawaannya berbahasa Inggris.

## Kode

| Berkas                                         | Isinya                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `apps/app/src/composables/virtualRange.ts`     | Aritmetika jendela — baris mana yang dirender, berapa paddingnya |
| `apps/app/src/composables/useVirtualWindow.ts` | Pengukuran DOM, pengamat gulungan & ukuran, ambang aktifnya      |
| `apps/app/src/components/entry/EntryGrid.vue`  | Grid library & browse                                            |
| `apps/app/src/pages/entry/EntryDetailPage.vue` | Daftar chapter/episode                                           |
| `apps/app/src/components/layout/AppShell.vue`  | Tautan lompat + `<main id="konten">`                             |
| `apps/app/src/assets/index.css`                | Aturan `prefers-reduced-motion`                                  |
| `apps/app/test/virtualRange.test.ts`           | Aturan jendela diuji tanpa DOM                                   |
