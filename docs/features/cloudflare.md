# Fitur: Verifikasi Cloudflare & User-Agent

**Status:** ✅ Selesai (deteksi di Fase 2 · WebView aplikasi di Fase 8) ·
**Route:** `/browse/:sourceId`, `/settings`

## Tujuan

Sebagian situs sumber menaruh tantangan Cloudflare — "verify you are human" — di
depan halamannya. Mirai **tidak memutari tantangan itu**. Sikapnya sama dengan
[Aniyomi](https://aniyomi.org/docs/guides/troubleshooting/): yang menyelesaikan
adalah penggunanya sendiri, di WebView, dan kalau tetap tidak bisa maka sumber
itu memang tidak bisa dipakai.

Yang bisa dikerjakan aplikasi ada dua, dan dua-duanya soal kejujuran:

1. **Mengenali** tantangan, supaya tidak muncul sebagai "403" atau "parser
   gagal" — dua pesan yang mengirim orang memperbaiki hal yang tidak rusak.
2. **Menyediakan jalannya**, lalu menyatakan terus terang di mana jalan itu
   buntu.

## User Flow

1. Buka sumber di Browse. Request pertama tertahan tantangan.
2. Alih-alih pesan error merah, muncul kartu **"<Sumber> meminta verifikasi
   Cloudflare"** dengan tombol dan penjelasan.
3. Di APK: **Selesaikan verifikasi** → situs terbuka → centang "I am human" →
   kembali ke Mirai → muat ulang.
4. Di web: kartunya menyatakan bahwa ini **tidak akan berhasil**, dan
   menyarankan APK atau sumber lain. Tombolnya tetap ada supaya pengguna bisa
   memastikan sendiri situsnya memang menantang.
5. Pengaturan → **User-Agent** untuk kasus di mana verifikasi berhasil tapi
   request sesudahnya tetap ditolak.

## Data & Aturan

### Kenapa web tidak bisa, dan kenapa itu bukan bug

Di build web, request extension dikirim `apps/proxy` dari sisi server. Cookie
`cf_clearance` yang didapat browser saat menyelesaikan tantangan terikat pada
**IP dan User-Agent yang menyelesaikannya**. Cookie itu tidak pernah sampai ke
proxy — browser tidak boleh membacanya untuk domain lain — dan seandainya
dipaksa sampai, ia tetap ditolak karena datang dari IP yang berbeda.

Ini bukan pekerjaan yang belum dikerjakan; ini konsekuensi langsung dari alasan
cookie itu ada. Karena itu UI-nya menyebutkannya, bukan menampilkan tombol yang
terlihat menjanjikan lalu diam-diam gagal.

Di APK jalannya ada: `CapacitorHttp` mengeksekusi request di sisi native dan
berbagi cookie jar dengan WebView aplikasi, jadi verifikasi yang selesai di
WebView terpakai oleh request berikutnya. Satu syaratnya: **UA-nya sama**.

### Aturan pengenalan

Salah mengenali ke dua arah sama-sama merugikan — tantangan yang terlewat bikin
parser menyalahkan dirinya sendiri, tantangan palsu bikin tombol verifikasi
muncul untuk hal yang tidak bisa diselesaikan siapa pun. Karena itu syaratnya
berlapis:

| Lapis     | Aturan                                                                    |
| --------- | ------------------------------------------------------------------------- |
| Status    | Harus `403`, `429`, atau `503`. Respons `200` tidak pernah jadi tantangan |
| Pengakuan | `cf-mitigated: challenge` → langsung tantangan, tanpa syarat lain         |
| Asal      | Kalau tidak ada header itu: `server: cloudflare` atau `cf-ray` wajib ada  |
| Penanda   | Ditambah penanda badan: `__cf_chl`, `challenge-platform`, `Just a moment` |

Jadi 403 JSON dari situs ber-Cloudflare tetap `HttpError` biasa, dan artikel
berjudul "Just a moment" tetap artikel.

### Di mana pemeriksaannya dipasang

Di **host**, membungkus transport — bukan di extension dan bukan di proxy.

- Bukan di extension: kalau tiap penulis extension harus menebak sendiri, yang
  didapat adalah lima tebakan berbeda dan tiga yang lupa. Ini juga bukan urusan
  yang berbeda antar-situs.
- Bukan di proxy: APK tidak memakai proxy sama sekali, jadi deteksinya akan
  hilang persis di satu-satunya platform yang bisa menindaklanjutinya.

`getJson()` ikut diperiksa lewat jalur yang sama. Tanpa itu, API JSON di balik
Cloudflare gagal sebagai "JSON tidak valid" — pesan yang menunjuk ke arah yang
sepenuhnya salah.

### Melintasi worker

`CloudflareChallengeError` dilempar di host, tapi UI menerimanya setelah error
itu melintas dua batas Worker dan kehilangan prototipenya. Karena itu
`challengeUrl` diangkut sebagai field di `SerializedError`, dan UI memutuskan
berdasarkan ada-tidaknya field itu — **bukan** dengan mencocokkan teks pesan,
yang akan diam-diam mati begitu kalimatnya diedit.

`challengeUrl` diisi origin situsnya, bukan URL yang kebetulan kena: tantangan
berlaku se-zona, dan halaman depan jauh lebih mungkin merender sesuatu yang
masuk akal daripada sebuah endpoint JSON.

### Setelan User-Agent

Aniyomi mendokumentasikan penggantian UA sebagai langkah perbaikan tersendiri,
dan alasannya konkret: `cf_clearance` hanya berlaku untuk UA yang
menyelesaikan tantangan. Kalau WebView memakai UA Android sementara extension
mengirim UA Chrome desktop, verifikasi yang sukses tetap berakhir ditolak.

- Kosong secara bawaan, dan kosong berarti **tidak menyentuh apa pun** —
  extension tetap memegang UA-nya sendiri.
- Kalau diisi, ia **menimpa**, bukan mengisi kalau kosong. `extension-lib`
  selalu memasang UA, jadi nilai yang cuma jadi cadangan tidak akan pernah
  terpakai dan setelannya jadi tombol mati.
- Dibaca **per request**. Mengganti UA adalah langkah diagnosis; memaksa restart
  untuk mencobanya membuat setelan itu hampir tidak berguna.
- Menimpa UA bisa mengubah markup yang dikirim situs sumber — sebagian situs
  menyajikan halaman berbeda untuk UA WebView Android. Karena itu ia alat
  diagnosis, bukan setelan yang perlu disentuh kalau semuanya sudah jalan.

### Di APK: WebView aplikasi, bukan Custom Tabs (Fase 8)

Tombol **Selesaikan verifikasi** membuka halamannya lewat
`browser.service.ts`, yang di APK memakai WebView milik aplikasi. Chrome Custom
Tabs tidak dipakai sama sekali: penyimpanannya terpisah, jadi verifikasi yang
selesai di sana tidak akan pernah terbaca `CapacitorHttp`. Detail teknisnya —
termasuk `isIsolated: false`, yang tanpa itu WebView plugin jalan di proses
terpisah dengan cookie jar sendiri — ada di [android.md](android.md).

Setelah WebView-nya ditutup, `openChallenge()` selesai dan `ChallengeNotice`
memancarkan `solved`; halaman pemanggilnya memuat ulang sendiri. `solved` cuma
berarti "orangnya sudah kembali" — kalau ternyata masih tertahan, kartu yang
sama muncul lagi, dan kalimat terakhirnya sudah mengatakan bahwa sumber itu
mungkin memang tidak bisa dipakai.

## Yang belum ada

Deteksinya berhenti di Cloudflare. Tantangan lain — DDoS-Guard, hCaptcha yang
dipasang situsnya sendiri — jatuh sebagai `HttpError` biasa dan menampilkan
pesan error apa adanya, bukan kartu verifikasi.

## Kode

| Berkas                                               | Peran                                                     |
| ---------------------------------------------------- | --------------------------------------------------------- |
| `packages/extension-api/src/http.ts`                 | `CloudflareChallengeError` + `challengeUrl`               |
| `packages/extension-runtime/src/http/cloudflare.ts`  | `isCloudflareChallenge()`, `withCloudflareDetection()`    |
| `packages/extension-runtime/src/http/shared.ts`      | `withUserAgent()`                                         |
| `packages/extension-runtime/src/http/index.ts`       | Urutan pembungkus transport                               |
| `packages/extension-runtime/src/protocol.ts`         | `challengeUrl` di `SerializedError` dan `SourceCallError` |
| `apps/app/src/services/challenge.service.ts`         | `challengeOf()`, `openChallenge()`, batas per platform    |
| `apps/app/src/services/browser.service.ts`           | WebView aplikasi + menunggu `browserClosed`               |
| `apps/app/src/services/settings.service.ts`          | Setelan yang harus terbaca sebelum Pinia hidup            |
| `apps/app/src/components/common/ChallengeNotice.vue` | Kartu tantangan                                           |
| `apps/app/src/pages/settings/SettingsPage.vue`       | Setelan User-Agent                                        |
| `packages/extension-runtime/test/cloudflare.test.ts` | Deteksi, batas salah-kenal, dan perjalanan lintas RPC     |
| `extensions/scripts/smoke.mjs`                       | Melaporkan `TERTAHAN`, bukan `GAGAL`                      |

## Verifikasi

```bash
pnpm test                          # deteksi, batas salah-kenal, setelan UA
node extensions/scripts/smoke.mjs  # KunManga → TERTAHAN, 4 paket lain lolos
```

Terverifikasi 2026-08-12 di browser: `/browse/kunmanga` menampilkan kartu
verifikasi beserta keterangan batas web, `/browse/komikcast` tidak ikut terkena,
dan setelan User-Agent tersimpan melewati reload.

> **Belum terverifikasi:** seluruh jalur APK — WebView, cookie jar bersama, dan
> apakah `cf_clearance` benar-benar terpakai request berikutnya. Kodenya sudah
> ada sejak Fase 8, tapi Android SDK belum terpasang di mesin ini, jadi belum
> ada satu pun percobaan di perangkat.
