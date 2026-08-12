# Fitur: Manajemen extension

**Status:** ✅ Selesai (Fase 2) · **Route:** `/extensions`

## Tujuan

Membuat sumber konten jadi sesuatu yang **dipasang pengguna**, bukan yang
dibawa aplikasi. Mirai tidak mengirim satu pun sumber di dalam APK-nya: yang
dikirim adalah kemampuan menambahkan repo, memasang paket dari repo itu, dan
memperbaruinya sendiri saat situs sumber berubah.

Konsekuensi yang disengaja: pemasangan baru mendarat di Browse yang **kosong**,
dengan tautan ke halaman ini.

## User Flow

1. Buka **Extension**. Kolom paling atas menerima URL repo — boleh URL
   foldernya, boleh URL `index.min.json`-nya langsung.
2. Repo divalidasi saat ditambahkan. URL salah ketik gagal saat itu juga dengan
   pesannya sendiri, bukan mengendap jadi baris merah permanen.
3. Daftar paket muncul dikelompokkan **Update tersedia → Terpasang → Tersedia**.
4. **Pasang** mengunduh bundel, menjalankannya di Worker, lalu mencatatnya.
   Paket yang gagal dijalankan tidak pernah tercatat sebagai terpasang.
5. Sakelar di tiap baris menyalakan/mematikan paket; ikon gerigi membuka
   setelannya; ikon tong sampah mencopotnya.
6. Sumber dari paket yang aktif langsung muncul di **Browse**.
7. Tutup aplikasi, buka lagi — semuanya masih terpasang, termasuk saat offline.

## Data & Aturan

### Repo

Repo extension adalah folder statis hasil `extensions/scripts/build.ts`:

```
<repo>/index.min.json
<repo>/js/<pkg>.js
<repo>/icon/<pkg>.svg
```

`index.min.json` diambil dengan `fetch` biasa, **bukan** lewat proxy. Repo
adalah berkas statis yang memang dimaksudkan untuk dibaca browser, dan GitHub
Pages mengirim `Access-Control-Allow-Origin: *`. Melewatkannya ke proxy justru
memaksa pengguna mendaftarkan host repo di allowlist yang dipakai untuk situs
sumber.

Isinya divalidasi sepenuhnya sebelum menyentuh penyimpanan
(`services/extensionRepo.service.ts`). Server repo tidak dipercaya: `apiVersion`
berupa teks, `hosts` kosong, atau paket tanpa `sources` ditolak dengan menyebut
paket mana yang bermasalah.

Menghapus repo **tidak** mencopot paket yang sudah dipasang darinya. Kodenya ada
di cache dan masih jalan; yang hilang cuma jalur update-nya.

### Penyimpanan

| Apa                         | Di mana        | Kenapa                                     |
| --------------------------- | -------------- | ------------------------------------------ |
| Daftar repo, paket, setelan | `localStorage` | Kecil, dan harus terbaca sinkron saat boot |
| Bundel kode extension       | Cache API      | ±275 KB per paket — linkedom ikut dibundel |

Bundel dibaca dari cache **lebih dulu**, bukan dari jaringan. Membuka aplikasi
tanpa koneksi harus tetap menampilkan sumber yang terpasang; kalau kodenya harus
diunduh ulang tiap boot, library offline jadi bohong.

Kunci cache memuat versi (`<pkg>/<version>.js`), jadi update tidak pernah
menyajikan kode lama. Bundel versi sebelumnya baru dibuang setelah versi baru
terbukti jalan.

### Kompatibilitas

`apiVersion` paket dicocokkan dengan `API_VERSION` aplikasi **sebelum** apa pun
diunduh. Yang tidak cocok tidak bisa dipasang, dengan pesan yang menyebut arah
masalahnya — "Butuh Mirai yang lebih baru" versus "Extension usang" — bukan
sekadar "tidak kompatibel".

### Setelan

Setelan dirender dari `SourcePreference[]` yang dideklarasikan extension
(`text`, `switch`, `list`, `multiselect`). Bentuknya deklaratif justru supaya
extension tidak pernah mengirim komponen: kode asing tetap tidak menyentuh DOM.

Setelan bersifat **per paket**, bukan per source: worker menerima satu
`PreferenceStore` untuk seluruh factory, jadi dua source dalam satu paket memang
berbagi ruang kunci. Itu batas kontrak `SourceContext`.

Menyimpan setelan menjalankan ulang Worker paket itu — nilainya cuma sampai ke
source lewat `SourceContext` waktu factory dipanggil. Mahal, tapi alternatifnya
adalah setelan yang baru berlaku setelah aplikasi di-restart.

### Aktif / nonaktif

Mematikan paket benar-benar `terminate()` Worker-nya, bukan menyembunyikan
barisnya. Extension yang tidak dipakai tidak boleh memegang memori atau menembak
jaringan.

### Saringan 18+

Mati secara default. Saat mati, paket bertanda `nsfw` disembunyikan dari halaman
ini **dan** dari daftar sumber di Browse — menyembunyikan paketnya saja tapi
membiarkan sumbernya muncul adalah kebocoran yang paling mudah terjadi.

### Kegagalan sebagian

Satu extension rusak tidak boleh mengosongkan seluruh daftar. Kegagalan
pemuatan dicatat di banner error, sisanya tetap jalan. Begitu juga update dan
penyimpanan setelan: Worker lama dibiarkan hidup sampai penggantinya terbukti
bisa dijalankan.

## Penerbitan repo

`.github/workflows/publish-extensions.yml` membangun `extensions/dist` dan
menerbitkannya ke GitHub Pages setiap kali `extensions/` atau paket
`extension-api`/`extension-lib` berubah. Build menjalankan tiap bundel sekali
untuk mengumpulkan source-nya, jadi paket yang lupa `export default` atau punya
host tak terdaftar gagal di CI — bukan setelah terlanjur terbit.

Selama pengembangan, `extensions/dist` disajikan Vite di `/ext-dev` dan
**terdaftar otomatis sebagai repo**, tapi tidak ada satu pun paket yang dipasang
otomatis. Kalau dipasang otomatis, jalur "tambah repo → pasang" yang dipakai
pengguna sungguhan tidak pernah dicoba selama pengembangan.

## Kode

| Path                                                    | Fungsi                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/app/src/services/extensionRepo.service.ts`        | Normalisasi URL repo, ambil dan **validasi** `index.min.json` |
| `apps/app/src/services/extensionStorage.service.ts`     | localStorage (repo, paket, setelan) + Cache API (bundel)      |
| `apps/app/src/services/extensions.service.ts`           | Transport, cek `apiVersion`, unduh bundel, jalankan Worker    |
| `apps/app/src/stores/extensions.ts`                     | Sumber kebenaran: repo, katalog, terpasang, aktif, 18+        |
| `apps/app/src/pages/extensions/ExtensionsPage.vue`      | Halaman: pencarian, saringan 18+, tiga kelompok               |
| `apps/app/src/components/extensions/RepoManager.vue`    | Tambah/hapus repo, jumlah paket, error per repo               |
| `apps/app/src/components/extensions/ExtensionRow.vue`   | Satu baris paket beserta seluruh aksinya                      |
| `apps/app/src/components/extensions/PreferenceForm.vue` | Render `SourcePreference[]` jadi form                         |
| `apps/app/src/components/ui/switch/`                    | Sakelar shadcn-vue di atas `reka-ui`                          |
| `extensions/scripts/build.ts`                           | Bundel esbuild + `index.min.json` + validasi hasil build      |
| `.github/workflows/publish-extensions.yml`              | Terbitkan `extensions/dist` ke GitHub Pages                   |
| `scripts/smoke.mjs`                                     | Smoke: pasang lewat UI, reload, sumber masih ada              |
