# Design system

Sumber kebenarannya adalah `apps/app/src/assets/index.css`. Dokumen ini
menjelaskan maksud tiap token dan pola pemakaiannya.

## 1. Prinsip

Mirai dipakai untuk membaca dan menonton, sering di ruangan gelap. Karena itu
**gelap adalah default**, kontras dijaga di teks, dan permukaan dibedakan lewat
lightness — bukan lewat garis tebal.

Mobile-first, tapi bukan aplikasi Android yang diregangkan: di layar lebar,
navigasi pindah ke sisi kiri dan grid melebar, bukan sekadar memusat dengan
lebar tetap.

## 2. Warna

Semua warna ditulis dalam OKLCH supaya penyesuaian terang/gelap hanya menggeser
lightness. **Tidak ada hex atau warna Tailwind mentah di komponen** — selalu
lewat token semantik.

| Token                       | Dipakai untuk                           |
| --------------------------- | --------------------------------------- |
| `background` / `foreground` | Latar halaman dan teks utama            |
| `card` / `card-foreground`  | Permukaan terangkat: header, nav, kartu |
| `popover`                   | Sheet, dropdown, dialog                 |
| `primary`                   | Aksi utama, item nav aktif, aksen merek |
| `secondary`                 | Tombol tenang, latar hover              |
| `muted-foreground`          | Teks penunjang, ikon nonaktif           |
| `accent`                    | Latar item nav aktif                    |
| `destructive`               | Hapus, batal unduhan, error             |
| `border` / `input` / `ring` | Garis, batas isian, cincin fokus        |

Token khusus Mirai, di luar palet shadcn:

| Token        | Dipakai untuk                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `unread`     | Badge jumlah chapter/episode belum dibaca di pojok cover                                                                  |
| `downloaded` | Penanda item yang tersimpan offline                                                                                       |
| `surface`    | Latar kartu cover — sengaja beda dari `card` supaya grid tidak lebur dengan latar halaman waktu gambar cover gagal dimuat |

## 3. Radius & spacing

`--radius: 0.75rem`; turunannya `radius-sm/md/lg/xl`. Cover memakai `rounded-lg`,
tombol `rounded-md`, badge `rounded-full`.

Spacing memakai skala Tailwind apa adanya. Padding halaman `p-4` di mobile,
konten teks dibatasi `max-w-2xl` supaya baris tidak terlalu panjang di desktop.

## 4. Breakpoint & navigasi

| Lebar           | Navigasi                   | Catatan                                                                 |
| --------------- | -------------------------- | ----------------------------------------------------------------------- |
| `< md` (768px)  | BottomNav 5 slot           | Mengikuti pola aplikasi mobile; slot kelima "Lainnya" menampung sisanya |
| `md … lg`       | SideRail 64px, ikon saja   | Label muncul sebagai `title`                                            |
| `≥ lg` (1024px) | Sidebar 240px dengan label | Unduhan, Extension, dan Pengaturan naik jadi baris tersendiri           |

Daftar itemnya satu sumber: `components/layout/navItems.ts`. Route yang
mengambil alih layar penuh (reader, player) menandai dirinya `meta.fullscreen`
dan shell menyembunyikan seluruh navigasi.

## 5. Grid cover

Responsif berbasis lebar, bukan jumlah kolom tetap: 2 kolom di 375px sampai 8
kolom di layar lebar. Rasio cover `2:3`. Badge belum dibaca di pojok kiri-atas,
penanda unduhan di pojok kanan-atas, judul dua baris dengan elipsis di bawah
cover.

## 6. Area aman & gestur

`pt-safe` dan `pb-safe` memakai `env(safe-area-inset-*)` untuk notch dan gesture
bar. `overscroll-behavior: none` dipasang di `body` supaya tarikan ke bawah di
APK tidak memicu pull-to-refresh WebView di tengah membaca.

## 7. Komponen

shadcn-vue di-vendor tangan di atas `reka-ui`. Satu folder per komponen:
`index.ts` memegang definisi `cva()` dan re-export, `Komponen.vue` membungkus
`Primitive` dan menggabungkan kelas lewat `cn()` dari `lib/utils.ts`. Prop
`class` dari pemanggil selalu digabung terakhir agar bisa menimpa varian.

Yang sudah ada: `button`, `badge`, `card`, `input`.
