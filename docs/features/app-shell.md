# Fitur: Shell layout & navigasi

**Status:** ✅ Selesai (Fase 0) · **Route:** semua route non-fullscreen

## Tujuan

Memberi satu kerangka yang sama untuk seluruh halaman, yang berubah bentuk
mengikuti lebar layar tanpa menduplikasi daftar navigasi, dan yang bisa
menyingkir sepenuhnya saat reader atau player mengambil alih layar.

## User Flow

1. Membuka aplikasi mendarat di `/library/anime` (redirect dari `/`).
2. Di bawah 768px navigasi ada di bawah layar berisi lima slot: Anime, Manga,
   Updates, Browse, Lainnya.
3. Mulai 768px navigasi pindah ke sisi kiri sebagai rail ikon; mulai 1024px
   rail melebar dan menampilkan label. Di lebar ini Unduhan, Extension, dan
   Pengaturan naik jadi baris tersendiri karena ada ruang.
4. Halaman "Lainnya" tetap ada di semua lebar supaya tautan langsung ke sana
   tidak buntu.
5. Route yang tidak dikenal menampilkan halaman 404 dengan jalan kembali.

## Data & Aturan

- **Satu sumber daftar navigasi.** `navItems.ts` mengekspor `navItems` dan
  `isNavActive()`; BottomNav dan SideRail dua-duanya membacanya, jadi isinya
  mustahil berbeda.
- **Aktif berdasarkan prefix.** Satu item nav menaungi beberapa route (Browse
  aktif juga di `/browse/:sourceId`), jadi kecocokannya prefix, bukan sama
  persis.
- **Fullscreen ditentukan route, bukan shell.** Halaman menandai dirinya
  `meta.fullscreen: true`; shell membaca itu. Reader dan player nanti tidak
  perlu mengubah kode shell sama sekali.
- **Navigasi menunjuk nama route**, bukan path, agar URL bisa berubah tanpa
  menyentuh navigasi.
- Semua halaman di-lazy load. Reader dan player akan membawa dependensi berat
  (hls.js, dekoder gambar) yang tidak boleh masuk bundel awal.
- Padding kiri konten (`md:pl-16 lg:pl-60`) mengimbangi rail yang `fixed`, dan
  padding bawah memberi ruang untuk BottomNav supaya baris terakhir grid tidak
  tertutup.

## Kode

| Berkas                                          | Peran                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/app/src/components/layout/navItems.ts`    | Daftar navigasi + `isNavActive()` — satu-satunya sumber                |
| `apps/app/src/components/layout/AppShell.vue`   | Memilih tata letak; membaca `meta.fullscreen`                          |
| `apps/app/src/components/layout/BottomNav.vue`  | Navigasi bawah, `md:hidden`                                            |
| `apps/app/src/components/layout/SideRail.vue`   | Rail/sidebar kiri, `hidden md:flex`                                    |
| `apps/app/src/components/layout/AppHeader.vue`  | Header sticky + slot `tabs`, aksi search/filter/refresh opsional       |
| `apps/app/src/components/common/EmptyState.vue` | Keadaan kosong dengan ikon, penjelasan, dan slot aksi                  |
| `apps/app/src/router/index.ts`                  | Definisi route, lazy load, `scrollBehavior`                            |
| `apps/app/src/pages/**`                         | Halaman; masih berupa keadaan kosong sampai fase berikutnya mengisinya |
| `apps/app/src/assets/index.css`                 | Token tema, utilitas `pt-safe`/`pb-safe`                               |
| `scripts/smoke.mjs`                             | Verifikasi alur di 375px dan 1440px                                    |

## Verifikasi

```bash
pnpm dev
node scripts/smoke.mjs
```

Menghasilkan `scripts/smoke-mobile.png` dan `scripts/smoke-desktop.png` untuk
diperiksa mata.
