# Fitur: Build Android (APK)

**Status:** ✅ Selesai (Fase 8) · ⚠️ Belum diuji di perangkat — Android SDK belum
terpasang di mesin pengembangan · **Route:** —

## Tujuan

Mirai dibangun web-first, tapi separuh janjinya cuma bisa ditepati di APK:
scraping tanpa CORS, `Referer`/`User-Agent` bebas untuk CDN video, verifikasi
Cloudflare yang benar-benar menempel, dan unduhan yang tinggal di penyimpanan
perangkat. Fase ini menyiapkan seluruh jalur itu — platform Android, ikon,
tanda tangan, dan rilis otomatis — supaya "buat APK-nya" berarti membuat satu
Release di GitHub, bukan mengingat delapan langkah manual.

## User Flow

**Pengguna:**

1. Buka halaman [Releases](https://github.com/karuhun-developer/mirai/releases).
2. Unduh `mirai-X.Y.Z.apk`, pasang (Android akan meminta izin "install unknown
   apps" sekali).
3. Rilis berikutnya dipasang **menimpa** yang lama — library, riwayat, dan
   unduhan tetap utuh.

**Pengembang:**

```bash
pnpm android:icons   # gambar ulang ikon & splash (jarang dipakai)
pnpm cap:sync        # build web + salin ke apps/app/android
pnpm android:open    # sync lalu buka Android Studio (khusus WSL)
```

**Rilis:**

1. Bump versi di `package.json` + `apps/app/package.json`, tulis `CHANGELOG.md`.
2. Buat Release di GitHub dengan tag `vX.Y.Z`.
3. Workflow `release-apk.yml` membangun APK-nya dan menempelkannya ke Release itu.

## Data & Aturan

### Versi datang dari tag, bukan dari `package.json`

`versionName` dan `versionCode` diturunkan dari tag Release:
`v0.0.1` → `versionName = "0.0.1"`, `versionCode = 0*10000 + 0*100 + 1 = 1`.

Rumus `X*10000 + Y*100 + Z` menjaga urutan naik selama minor dan patch di bawah
100 — cukup untuk seumur hidup proyek ini, dan jauh lebih mudah dibaca daripada
nomor build yang berjalan sendiri.

**Itu juga alasan rilis pertama bernomor 0.0.1, bukan 1.0.0.** `versionCode`
tidak boleh turun: sekali sebuah APK bernomor 10000 terpasang, tidak ada rilis
0.x yang bisa menimpanya, dan itu tidak bisa dibatalkan. Mulai dari 1
menyisakan seluruh ruang 0.x — lihat
[CHANGELOG.md](../../CHANGELOG.md#kenapa-mulai-dari-001). Tag yang bukan `vX.Y.Z` menghentikan workflow
dengan pesan yang menyebutkan formatnya, bukan membangun APK bernomor asal.

Di sisi Gradle nilainya masuk sebagai property:

```gradle
def appVersionCode = (project.findProperty('appVersionCode') ?: '1').toString().toInteger()
def appVersionName = (project.findProperty('appVersionName') ?: '1.0').toString()
```

Dihitung ke variabel dulu karena `versionCode (project.findProperty(...))` dibaca
parser Groovy sebagai pemanggilan method, bukan penetapan nilai. Fallback `1` /
`"1.0"` membuat build lokal dan Android Studio tetap jalan tanpa property apa pun.

### Keystore debug ikut di-commit

APK yang dirilis adalah build **debug**. Kalau tiap mesin memakai keystore debug
bawaannya sendiri (`~/.android/debug.keystore`, dibuat acak saat pertama kali
dipakai), tanda tangan tiap rilis berbeda — dan Android menolak memasang
pembaruan di atas versi yang tanda tangannya lain. Pengguna harus uninstall
dulu, yang berarti kehilangan seluruh library, riwayat, dan unduhan.

Karena itu `apps/app/android/debug.keystore` ikut masuk repo dengan kata sandi
`android`, sama seperti keystore debug bawaan Android SDK. Rahasianya nol dan
memang tidak ada yang perlu dirahasiakan — ini bukan kunci rilis, dan APK-nya
tidak pernah masuk Play Store.

### Izin: cuma `INTERNET`

| Izin                     | Status         | Alasan                                                                                                                 |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `INTERNET`               | ✅ diminta     | Semua request extension dan media                                                                                      |
| `WRITE_EXTERNAL_STORAGE` | ❌ tidak perlu | Unduhan ditulis ke `Directory.Data`, direktori privat aplikasi                                                         |
| `POST_NOTIFICATIONS`     | ❌ belum       | Belum ada notifikasi progres yang dikirim; meminta izin untuk sesuatu yang tidak ada cuma melatih orang menolak dialog |
| `FOREGROUND_SERVICE`     | ❌ belum       | Antrean unduhan berhenti waktu aplikasi ditutup, lalu dilanjutkan saat dibuka lagi                                     |

`android:usesCleartextTraffic="true"` dipasang untuk alasan yang sama dengan
`allowMixedContent` di `capacitor.config.ts`: extension pihak ketiga bisa
menunjuk ke host yang belum HTTPS, dan pembatasan yang sebenarnya ada di
allowlist host milik manifest extension — bukan di lapisan WebView, yang cuma
bisa menolak semuanya atau menerima semuanya.

### Ikon dan splash digambar Playwright

`scripts/make-icons.mjs` menghasilkan 26 berkas: `ic_launcher` (kotak-bulat),
`ic_launcher_round` (lingkaran), `ic_launcher_foreground` (kanvas 108dp untuk
ikon adaptif), dan 11 ukuran splash, semuanya dari satu path SVG huruf "M".

Pilihan alatnya sengaja: `@capacitor/assets` menarik `sharp` — 292 paket plus
binary native yang harus dibangun saat install — untuk pekerjaan yang dijalankan
mungkin dua kali seumur proyek. Playwright sudah ada di repo untuk smoke test,
Chromium-nya sudah terpasang, dan penggambarnya sama persis dengan yang membuat
favicon web. Tidak ada dependensi baru sama sekali.

Aturan yang dijaga generator:

- **Foreground digambar di kanvas 108dp dengan tanda cuma 40% lebarnya.**
  Peluncur memotong ikon adaptif jadi lingkaran atau kotak-bulat selebar 72dp di
  tengah; tanda yang memenuhi kanvas akan terpotong sisinya di sebagian
  peluncur.
- **`@color/ic_launcher_background` harus sama dengan latar yang digambar**
  (`#0b0f13`). Kalau tidak, lapisan foreground mengambang di atas kotak putih
  begitu peluncur memilih bentuk lingkaran.
- **`AppTheme.NoActionBar` diberi latar gelap**, bukan `@null` bawaan template:
  tanpa itu ada satu frame putih antara splash dan halaman pertama WebView.

### Halaman luar dibuka WebView aplikasi, bukan Custom Tabs

Ini satu-satunya bagian Fase 8 yang menyentuh kode aplikasi, dan alasannya
cookie. `CapacitorHttp` mengeksekusi request extension di sisi native memakai
`CookieManager` milik WebView aplikasi. Chrome Custom Tabs punya penyimpanannya
sendiri — `cf_clearance` yang didapat di sana tidak akan pernah terbaca request
berikutnya, jadi verifikasinya selesai dan sumbernya tetap tertahan.

`browser.service.ts` menaruh aturan itu di satu tempat untuk dua pemakainya:
kartu verifikasi Cloudflare dan tombol host `embed` di pemutar.

```ts
android: { ...DefaultWebViewOptions.android, isIsolated: false },
```

`isIsolated` bawaannya `true`, yang menjalankan WebView plugin di **proses
terpisah**. Android melarang dua proses memakai satu direktori data WebView, jadi
proses terpisah berarti cookie terpisah — persis satu-satunya hal yang kita
butuhkan dari WebView ini. `clearCache`/`clearSessionCache` dibiarkan mati dengan
alasan yang sama.

UA-nya mengikuti setelan **User-Agent** di Pengaturan, karena `cf_clearance`
hanya berlaku untuk UA yang menyelesaikan tantangan — lihat
[cloudflare.md](cloudflare.md).

### Kembali dari WebView langsung memuat ulang

`openChallenge()` menunggu `browserClosed` sebelum selesai, dan
`ChallengeNotice` memancarkan `solved` sesudahnya. Empat halaman yang memakai
kartu itu (detail entry, browse sumber, reader, pemutar) menyambungkannya ke
fungsi muat ulang masing-masing.

`solved` **tidak** berarti "verifikasinya berhasil" — tidak ada yang bisa tahu
itu dari sisi aplikasi. Artinya "orangnya sudah kembali", dan satu-satunya cara
memastikan hasilnya memang mencoba lagi. Yang dihemat adalah tombol kedua yang
harus ditemukan sendiri setelah menutup WebView. Di web `whenExternalClosed()`
selesai seketika: tab baru tidak punya "ditutup" yang bisa ditunggu.

Pendengarnya dilepas setelah sekali terpanggil. Halaman bisa ditinggalkan kapan
saja, dan pendengar yang menumpuk membuat satu penutupan WebView memicu belasan
pemuatan ulang sekaligus.

### `node-linker=hoisted` bukan preferensi

`.npmrc` sudah memaksanya sejak Fase 0, dan Fase 8 adalah tempat alasannya
terbukti: CLI Capacitor mencari plugin dengan menyisir `node_modules` yang datar.
Dengan symlink pnpm bawaan, `cap sync` tidak menemukan satu plugin pun dan
`capacitor.settings.gradle` keluar kosong — tanpa error, cuma APK tanpa SQLite,
tanpa Filesystem, tanpa WebView.

## Yang sengaja belum ada

- **Notifikasi progres unduhan.** Butuh foreground service supaya antreannya
  tetap jalan waktu aplikasi ditutup; keduanya satu paket pekerjaan dan tidak
  ada gunanya menambah izin tanpa layanannya.
- **Build release ber-tanda tangan.** Perlu keystore rahasia di GitHub Secrets.
  Selama distribusinya lewat APK di halaman Release, debug-signed sudah cukup
  dan jauh lebih sedikit yang bisa salah.
- **Play Store.** Sumber kontennya pihak ketiga; kebijakan Play soal itu bukan
  sesuatu yang bisa diselesaikan dari sisi teknis.
- **iOS.** `apps/app/ios/` ada di `.gitignore`; tidak ada mesin macOS untuk
  memverifikasinya, dan platform yang tidak pernah dijalankan cuma jadi kode
  mati yang menua.

## Kode

| Berkas                                                | Peran                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `apps/app/capacitor.config.ts`                        | `appId`, `CapacitorHttp.enabled`, `allowMixedContent`       |
| `apps/app/android/app/build.gradle`                   | `-PappVersionCode`/`-PappVersionName`, signingConfig debug  |
| `apps/app/android/debug.keystore`                     | Tanda tangan bersama supaya rilis bisa saling menimpa       |
| `apps/app/android/variables.gradle`                   | minSdk 24 · compileSdk 36 · targetSdk 36                    |
| `apps/app/android/app/src/main/AndroidManifest.xml`   | Izin `INTERNET`, `usesCleartextTraffic`                     |
| `apps/app/android/app/src/main/res/values/colors.xml` | Menimpa warna Material bawaan library capacitor-android     |
| `apps/app/android/app/src/main/res/values/styles.xml` | Latar gelap antara splash dan WebView                       |
| `scripts/make-icons.mjs`                              | Generator ikon & splash (Playwright, tanpa dependensi baru) |
| `scripts/open-android.sh`                             | Build + sync + buka Android Studio dari WSL                 |
| `.github/workflows/release-apk.yml`                   | Release published → APK ditempel ke Release                 |
| `apps/app/src/services/browser.service.ts`            | Satu tempat aturan membuka halaman luar                     |
| `apps/app/src/services/challenge.service.ts`          | `openChallenge()` + menunggu WebView ditutup                |
| `apps/app/src/components/common/ChallengeNotice.vue`  | Memancarkan `solved` setelah orangnya kembali               |
| `apps/app/src/pages/player/PlayerPage.vue`            | Tombol host `embed` lewat `openExternal()`                  |

## Verifikasi

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm format:check
node scripts/smoke.mjs        # jalur web tidak ikut berubah
pnpm cap:sync                 # butuh Android SDK
```

Terverifikasi 2026-08-13: `pnpm cap:sync` menyalin bundel web dan mendeteksi
tujuh plugin, ikon dan splash hasil generator diperiksa satu per satu, dan smoke
web tetap hijau setelah tombol `embed` pindah dari `<a target="_blank">` ke
`openExternal()`.

> **Belum terverifikasi:** semua yang butuh perangkat — `./gradlew assembleDebug`,
> pemasangan APK, cookie jar bersama antara WebView dan `CapacitorHttp`,
> pemutaran HLS native, dan penulisan unduhan ke `Directory.Data`. Android SDK
> belum terpasang di mesin ini; workflow rilis akan menjadi build pertama yang
> benar-benar mengompilasinya.
