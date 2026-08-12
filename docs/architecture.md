# Arsitektur

## Lapisan

```
UI (pages/components)
  → Pinia store          (state, tanpa SQL)
    → Service            (orkestrasi lintas repository, satu transaksi)
      → Repository       (satu tabel, SQL di sini saja)
        → Db             (antarmuka; native vs web di baliknya)
```

**Store dan komponen tidak pernah menulis SQL.** Aturan ini yang menjaga
penggantian driver penyimpanan tidak merembet ke UI.

Jalur data dari extension berjalan sejajar, tidak lewat DB:

```
UI → store → extension-runtime → Worker (kode extension)
                                   → HttpClient (RPC balik ke host)
                                     → CapacitorHttp (native) | proxy (web)
```

## Paket

| Paket                        | Isi                                             | Kenapa dipisah                                                                           |
| ---------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/extension-api`     | Tipe + abstract class kontrak                   | Nol dependensi, jadi versinya stabil dan extension lama tidak pecah saat toolkit berubah |
| `packages/extension-lib`     | Parser HTML, HttpClient, filter, resolver video | Boleh gemuk — ikut dibundel ke tiap extension, bukan ke app                              |
| `packages/extension-runtime` | Loader, sandbox Worker, RPC, manajemen repo     | Satu-satunya yang tahu cara menjalankan kode asing                                       |
| `packages/core`              | Library, updates, antrean unduhan, backup       | Domain murni, tidak tahu Vue                                                             |
| `packages/db`                | Skema, migrasi, repository                      | Satu-satunya tempat SQL                                                                  |
| `packages/ui`                | Komponen lintas halaman                         | Dipakai app dan (nanti) halaman preview extension                                        |
| `apps/app`                   | SPA Vue + host Capacitor                        | Yang dibungkus jadi APK                                                                  |
| `apps/proxy`                 | Fastify: `/fetch` + `/stream`                   | Hanya dipakai build web                                                                  |

## Jaringan

Browser memblokir request lintas-origin ke situs sumber, sementara CDN video
sering menolak permintaan tanpa `Referer`/`User-Agent` yang benar. Karena itu
`HttpClient` punya dua adapter dan pemilihannya di runtime:

- **Native (APK).** `CapacitorHttp` (diaktifkan di `capacitor.config.ts`)
  mem-patch `fetch`/XHR di level native. Bebas CORS, header apa pun boleh
  dipasang, dan tidak ada server perantara.
- **Web.** Semua request menempuh `apps/proxy`. Proxy tidak menyimpan apa pun;
  ia meneruskan byte, meneruskan `Range` apa adanya (wajib untuk video), dan
  memasang header CORS. Tujuan yang berupa alamat internal — loopback, jaringan
  privat, metadata cloud — ditolak, dan tiap lompatan redirect diperiksa ulang:
  gerbang SSRF, karena URL-nya dikendalikan kode pihak ketiga. Situs publik tidak
  dibatasi daftar apa pun; alasannya di
  [features/network-proxy.md](features/network-proxy.md#kenapa-tanpa-allowlist).

Rate limit, cookie jar, dan retry dipasang di sisi host, bukan di dalam
extension, supaya satu extension nakal tidak bisa membanjiri situs sumber.

## Sandbox extension

Tiap extension dijalankan di satu Web Worker (`type: 'module'`) dan
berkomunikasi lewat RPC `{ id, method, args }`. Di dalam Worker:

- tidak ada DOM dan tidak ada akses ke penyimpanan aplikasi;
- `fetch` global diganti sehingga setiap request kembali ke host untuk
  diputuskan dan dicatat;
- parsing HTML memakai `linkedom` — Worker tidak punya `DOMParser`.

## Penyimpanan

Metadata di SQLite: `@capacitor-community/sqlite` di native, `jeep-sqlite` +
`sql.js` (wasm → IndexedDB) di web. Raw SQL di balik antarmuka `Db`, tanpa ORM.

Berkas media **tidak** masuk SQLite. Halaman manga dan berkas video ditulis ke
Filesystem di native dan OPFS di web; barisnya di tabel `download` hanya
menyimpan path. Menaruh biner di dalam baris membuat setiap operasi tulis
menyeret megabyte yang tidak perlu.

## Boot

`apps/app/src/main.ts` menjalankan urutan yang eksplisit dan berurutan. Mulai
Fase 3 `initDb()` berjalan sebelum Pinia, karena store membaca DB saat dibuat.
Kalau boot gagal, aplikasi sengaja tidak mount setengah jadi — panel error mentah
lebih berguna daripada layar kosong.
