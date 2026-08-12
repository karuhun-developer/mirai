# Fitur: Proxy jaringan (`apps/proxy`)

**Status:** ✅ Selesai (Fase 1) · **Route:** `GET /health`, `POST /fetch`, `GET /stream`

## Tujuan

Di APK, `CapacitorHttp` menembus CORS secara native dan proxy tidak dipakai sama
sekali. Di browser tidak ada jalan seperti itu: situs sumber tidak memasang
header CORS, jadi build web butuh perantara. Perantara itu harus melakukan
tepat dua hal — meneruskan byte dan menolak tujuan yang berbahaya — tanpa
menyimpan apa pun.

## User Flow

Tidak ada UI. Jalur pemakaiannya:

1. Extension memanggil `ctx.http.get(url)` di dalam worker.
2. Host meneruskannya ke `POST /fetch`; proxy memeriksa tujuan, mengambil, dan
   mengembalikan `{ url, status, ok, headers, body }`.
3. Cover dan video tidak lewat jalur itu. `MediaResolver` mengubahnya jadi
   `GET /stream?url=…`, yang langsung dipasang ke `<img>`/`<video>`.
4. Tujuan yang ditolak kebijakan menghasilkan **403** dengan alasan dalam bahasa
   manusia; sumber yang tidak terjangkau menghasilkan **502** beserta penyebab
   aslinya.

## Data & Aturan

### Gerbang SSRF

URL yang sampai ke proxy ditentukan kode pihak ketiga. Tanpa gerbang, satu
extension jahat cukup meminta `http://169.254.169.254/…` dan proxy dengan patuh
mengambilkan kredensial instance dari dalam jaringannya sendiri.

- **Tidak ada allowlist host.** `PROXY_ALLOWED_HOSTS` kosong — nilai bawaannya —
  berarti host publik mana pun boleh. Lihat [Kenapa tanpa allowlist](#kenapa-tanpa-allowlist).
- **Kalau diisi**, kecocokannya bukan `endsWith` polos: `mangadex.org`
  mengizinkan `cdn.mangadex.org` tetapi menolak `notmangadex.org` dan
  `mangadex.org.jahat.test`. `*` mewakili tepat satu label DNS.
- **Alamat internal ditolak** lebih dulu, selalu, dan tidak bisa dimatikan lewat
  env: loopback, `10./172.16-31./192.168./169.254./0.`, `localhost`, IPv6 `::1`,
  `fc00::/7`, `fe80::/10`.
- **IPv4-mapped dikenali dalam dua bentuk.** `new URL()` menormalkan
  `::ffff:127.0.0.1` jadi heksa `::ffff:7f00:1`; pemeriksaan yang cuma mengenali
  notasi titik akan meleset. Bentuk desimal (`http://2130706433/`) dan heksa
  (`http://0x7f000001/`) sudah dinormalkan `new URL()` jadi `127.0.0.1`.
- **Setiap lompatan redirect diperiksa ulang.** Redirect ditangani manual
  (`redirect: 'manual'`, maksimal 5 lompatan) karena redirect adalah cara paling
  gampang memindahkan request ke alamat internal setelah lolos pemeriksaan
  pertama. `Referer` ikut dipindah ke origin yang baru.
- Protokol selain `http:`/`https:` ditolak — termasuk `file:`.

### Kenapa tanpa allowlist {#kenapa-tanpa-allowlist}

Fase 1 mengharuskan tiap host tujuan terdaftar di `PROXY_ALLOWED_HOSTS`, diisi
tangan dari `hosts[]` manifest. Itu tidak pernah bisa benar: **sumber dipasang
pengguna saat aplikasi jalan**, sedangkan daftar itu dibaca sekali waktu proxy
start. Jadi setiap extension yang dipasang setelah proxy hidup dijamin kena
`403 Host … tidak ada di allowlist` — bukan kadang-kadang, tapi selalu. Gejalanya
persis seperti sumbernya rusak, padahal yang salah konfigurasi proxy.

Pilihan yang tersedia ada dua: mengirim `hosts[]` dari aplikasi di setiap
request, atau melepas pembatasnya. Yang pertama cuma teater — daftarnya datang
dari pihak yang sama dengan yang mengirim URL-nya, jadi tidak menahan apa pun
selain menambah satu lapis kode.

Yang benar-benar melindungi bukan daftar situs boleh/tidak boleh, melainkan
gerbang alamat internal: proxy tidak akan pernah menyentuh `127.0.0.1`,
`169.254.169.254`, jaringan privat, atau `file:` — dan itu diperiksa ulang di
setiap lompatan redirect. Batas itu tetap, dan tidak ada variabel env yang bisa
mematikannya.

`PROXY_ALLOWED_HOSTS` tetap ada untuk satu kasus yang tersisa: proxy yang
dipasang di server untuk dipakai bersama-sama, di mana pemiliknya memang mau
membatasi. Untuk dev dan pemakaian sendiri, biarkan kosong.

### Streaming, bukan buffering

`/stream` meneruskan `Range` apa adanya, memasang `accept-ranges`, dan mengirim
body lewat `Readable.fromWeb()`. Menahan video di memori proxy akan mematikannya
pada berkas pertama yang lebih besar dari RAM. `/fetch` memang membaca body
sampai habis — parser extension butuh seluruh dokumen — dan karena itu punya
batas ukuran (`PROXY_MAX_BODY_BYTES`, 413 kalau lewat).

### Header

Header hop-by-hop dan header identitas klien dibuang di kedua arah. `Referer`
dan `User-Agent` yang diminta extension **diteruskan** — banyak CDN memeriksanya
dan menolak permintaan tanpa keduanya.

### Pesan kegagalan

`fetch()` Node membungkus semua kegagalan jaringan jadi satu pesan "fetch
failed" yang tidak memberi tahu apa pun. Rantai `cause` dibuka sampai empat
tingkat dan kode errornya ikut disertakan, jadi yang sampai ke layar berbunyi
`fetch failed — getaddrinfo ENOTFOUND api.mangadex.org (ENOTFOUND)`. Selisih
antara "situsnya mati" dan "DNS-nya diblokir" menentukan langkah user
berikutnya.

## Konfigurasi

| Variabel                | Default                    | Keterangan                                                                 |
| ----------------------- | -------------------------- | -------------------------------------------------------------------------- |
| `PROXY_HOST`            | `127.0.0.1`                |                                                                            |
| `PROXY_PORT`            | `5181`                     |                                                                            |
| `PROXY_ALLOWED_HOSTS`   | _(kosong = tanpa batas)_   | Opsional, dipisah koma. Untuk proxy yang dipakai bersama-sama              |
| `PROXY_ALLOWED_ORIGINS` | _(kosong = izinkan semua)_ | CORS untuk aplikasi web; `.env.example` mengisinya `http://localhost:5180` |
| `PROXY_MAX_BODY_BYTES`  | 8 MiB                      | Batas `/fetch`                                                             |

Salin `apps/proxy/.env.example` ke `apps/proxy/.env` sebelum `pnpm dev:proxy`.

## Kode

| Berkas                                         | Peran                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `apps/proxy/src/guard.ts`                      | Deteksi alamat internal, pembatas host opsional, `assertAllowed()`   |
| `apps/proxy/src/fetcher.ts`                    | Redirect manual + pemeriksaan ulang tiap lompatan, sanitasi header   |
| `apps/proxy/src/routes.ts`                     | `/health`, `/fetch`, `/stream`, penerjemah pesan kegagalan           |
| `apps/proxy/src/config.ts`                     | Pembacaan env                                                        |
| `apps/proxy/src/index.ts`                      | Fastify + CORS; peringatan kalau dengar di luar loopback tanpa batas |
| `apps/proxy/test/guard.test.ts`                | Test gerbang SSRF                                                    |
| `packages/extension-runtime/src/http/proxy.ts` | Sisi klien: `HttpClient` + `MediaResolver`                           |

## Verifikasi

```bash
pnpm dev:proxy
pnpm test                       # test unit gerbang SSRF

curl -s localhost:5181/health
# {"ok":true,"hostLimits":0}      ← 0 = tanpa pembatas host

curl -s -XPOST localhost:5181/fetch -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9/x"}'
# {"error":"Alamat jaringan internal tidak boleh diakses lewat proxy"}

curl -s -XPOST localhost:5181/fetch -H 'content-type: application/json' \
  -d '{"url":"http://169.254.169.254/latest/meta-data/"}'
# {"error":"Alamat jaringan internal tidak boleh diakses lewat proxy"}

curl -s -XPOST localhost:5181/fetch -H 'content-type: application/json' \
  -d '{"url":"file:///etc/passwd"}'
# {"error":"Protokol file: tidak diizinkan"}
```

> **Belum terverifikasi:** `/stream` dengan `Range` terhadap CDN sungguhan.
> Akan ikut terverifikasi di Fase 5 (player) pada jaringan yang normal.
