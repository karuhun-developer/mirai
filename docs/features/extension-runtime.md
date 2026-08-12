# Fitur: Runtime extension & Browse

**Status:** ✅ Selesai (Fase 1) · **Route:** `/browse`, `/browse/:sourceId`

## Tujuan

Menjalankan kode sumber pihak ketiga tanpa memberinya akses ke DOM, database,
atau jaringan secara langsung — lalu memakai hasilnya untuk menampilkan katalog
di halaman Browse. Kontraknya harus cukup umum untuk manga dan anime sekaligus,
supaya fase berikutnya tinggal memakainya, bukan mengubahnya.

## User Flow

1. Buka **Browse**. Aplikasi membaca index repo extension, mengunduh bundel tiap
   extension, dan menjalankannya masing-masing di satu Web Worker.
2. Daftar sumber muncul dengan bahasa dan jenisnya (`ALL · manga`). Extension
   yang gagal dimuat tidak mengosongkan daftar — yang lain tetap tampil, dan
   errornya ditampilkan di atas daftar.
3. Pilih sumber → grid cover hasil **Populer**. Ada tab **Terbaru** (nonaktif
   kalau `supportsLatest: false`) dan kotak pencarian.
4. "Muat lebih banyak" menambah halaman berikutnya selama `hasNextPage` benar.
5. Kegagalan jaringan tampil sebagai pesan yang menyebut lapisannya —
   "Ditolak kebijakan proxy", "Sumber tidak bisa dihubungi lewat proxy" — bukan
   spinner yang menggantung.

## Data & Aturan

### Sandbox

- **Satu Worker per extension**, `type: 'module'`. Komunikasi lewat RPC
  `{ id, kind, … }`; tidak ada state bersama.
- Setelah modul extension dimuat, worker mematikan `fetch`,
  `XMLHttpRequest`, dan `importScripts`. `fetch` diganti fungsi yang melempar
  dengan pesan yang menunjuk `ctx.http`, bukan dihapus diam-diam — penulis
  extension harus tahu kenapa kodenya gagal.
- Worker tidak punya DOM. Parsing HTML memakai **`linkedom`**, yang ikut
  dibundel ke tiap extension.

### Pemuatan kode

Bundel **diunduh host**, lalu diserahkan ke worker sebagai string dan di-`import`
lewat **blob URL**. Worker tidak pernah mengambil kodenya sendiri. Dua alasan:
`ctx.http` tetap jadi satu-satunya jalur keluar, dan repo di GitHub Pages tidak
perlu memasang header CORS.

### Versi API

Runtime membandingkan `apiVersion` manifest dengan `API_VERSION` dan menolak
yang tidak cocok sambil menyebut **kedua** angkanya. Extension usang gagal
dengan penjelasan, bukan dengan `undefined is not a function` di tengah parsing.

### Transport

Satu interface `HttpClient`, dua adapter, dipilih otomatis:

| Lingkungan | Adapter         | Alasan                                        |
| ---------- | --------------- | --------------------------------------------- |
| APK        | `CapacitorHttp` | Bebas CORS, bisa memasang `Referer`/`UA`      |
| Web        | `apps/proxy`    | Browser tidak bisa menembus CORS situs sumber |

Keduanya dibungkus `withRateLimit(http, 3)` — jeda minimum per host, bukan
global, supaya satu source yang sibuk tidak memperlambat yang lain.

Gambar dan video **tidak** lewat RPC; terlalu besar untuk dipindah sebagai
string. `MediaResolver` cuma menerjemahkan URL: apa adanya di native, lewat
`/stream` di web.

### Halaman Browse

- Store menyimpan extension di `shallowRef`. Proxy reaktif Vue akan membungkus
  instance yang memegang `Worker` dan merusak identitas kelasnya.
- `Promise.allSettled` saat memuat: satu extension rusak tidak boleh
  mengosongkan daftar.
- `SourceBrowsePage` memakai **token request**. Tanpa itu, respons "populer"
  yang datang terlambat akan menimpa hasil pencarian yang sudah benar.

## Kode

| Berkas                                                    | Peran                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `packages/extension-api/src/`                             | Kontrak murni: model, source, filter, preferences, http        |
| `packages/extension-api/src/context.ts`                   | `API_VERSION`, `SourceContext`, `SourceFactory`                |
| `packages/extension-lib/src/http-source.ts`               | `ParsedHttpSource` + turunan manga/anime                       |
| `packages/extension-lib/src/html.ts`                      | `linkedom` di balik tipe `MDocument`/`MElement` yang sempit    |
| `packages/extension-lib/src/{filters,json,util}.ts`       | Builder filter, pembaca JSON `unknown`, util                   |
| `packages/extension-runtime/src/protocol.ts`              | Bentuk pesan RPC host ⇄ worker                                 |
| `packages/extension-runtime/src/sandbox.worker.ts`        | Sandbox: import blob, broker HTTP, matikan API jaringan        |
| `packages/extension-runtime/src/host.ts`                  | `ExtensionInstance`, cek `apiVersion`, timeout 30 dtk, binding |
| `packages/extension-runtime/src/http/`                    | Adapter Capacitor & proxy, rate limit, `MediaResolver`         |
| `extensions/src/{id,en}/*/`                               | Extension bawaan repo dev — bukti kontraknya generic           |
| `extensions/scripts/build.ts`                             | esbuild → satu ESM per source + `index.min.json`               |
| `apps/app/src/services/extensions.ts`                     | Baca index repo, unduh bundel, muat ke runtime                 |
| `apps/app/src/stores/sources.ts`                          | Daftar source untuk UI                                         |
| `apps/app/src/pages/browse/BrowsePage.vue`                | Daftar sumber terpasang                                        |
| `apps/app/src/pages/browse/SourceBrowsePage.vue`          | Populer/Terbaru/Cari + paginasi                                |
| `apps/app/src/components/entry/{EntryCard,EntryGrid}.vue` | Grid cover responsif                                           |
| `apps/app/vite.config.ts`                                 | Menyajikan `extensions/dist` di `/ext-dev` saat dev            |

## Verifikasi

```bash
pnpm --filter @mirai/extensions build
pnpm dev
pnpm dev:proxy
node scripts/smoke.mjs
pnpm test
```

Smoke memeriksa bahwa "Komikcast" muncul di Browse. Nama itu **cuma** bisa
muncul kalau index repo terbaca, bundel-nya ter-import di dalam Worker lewat
blob URL, factory-nya jalan, dan `describe()` kembali ke host lewat RPC — jadi
satu cek itu membuktikan seluruh rantai runtime.

Pemetaan tiap source ke situs aslinya diuji terpisah lewat
`node extensions/scripts/smoke.mjs`, yang memanggil situs sungguhan. Hasil
terakhir: Aniwatch, Komikcast, Mangabat, dan Otakudesu hijau; KunManga tertahan
verifikasi Cloudflare — lihat
[network-proxy.md](network-proxy.md#verifikasi-cloudflare).
