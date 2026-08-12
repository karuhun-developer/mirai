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

- **Allowlist gagal-tertutup.** `PROXY_ALLOWED_HOSTS` kosong = tolak semua.
  Proxy yang ter-deploy tanpa konfigurasi harus jadi tembok, bukan open relay.
- **Kecocokan host bukan `endsWith` polos.** `mangadex.org` mengizinkan
  `cdn.mangadex.org` tetapi menolak `notmangadex.org` dan
  `mangadex.org.jahat.test`.
- **Alamat internal ditolak** sebelum allowlist diperiksa: loopback,
  `10./172.16-31./192.168./169.254./0.`, `localhost`, IPv6 `::1`, `fc00::/7`,
  `fe80::/10`.
- **IPv4-mapped dikenali dalam dua bentuk.** `new URL()` menormalkan
  `::ffff:127.0.0.1` jadi heksa `::ffff:7f00:1`; pemeriksaan yang cuma mengenali
  notasi titik akan meleset. Bentuk desimal (`http://2130706433/`) dan heksa
  (`http://0x7f000001/`) sudah dinormalkan `new URL()` jadi `127.0.0.1`.
- **Setiap lompatan redirect diperiksa ulang.** Redirect ditangani manual
  (`redirect: 'manual'`, maksimal 5 lompatan) karena redirect adalah cara paling
  gampang memindahkan request ke alamat internal setelah lolos pemeriksaan
  pertama. `Referer` ikut dipindah ke origin yang baru.
- Protokol selain `http:`/`https:` ditolak — termasuk `file:`.

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
| `PROXY_ALLOWED_HOSTS`   | _(kosong = tolak semua)_   | Dipisah koma; sumbernya `hosts[]` manifest                                 |
| `PROXY_ALLOWED_ORIGINS` | _(kosong = izinkan semua)_ | CORS untuk aplikasi web; `.env.example` mengisinya `http://localhost:5180` |
| `PROXY_MAX_BODY_BYTES`  | 8 MiB                      | Batas `/fetch`                                                             |

Salin `apps/proxy/.env.example` ke `apps/proxy/.env` sebelum `pnpm dev:proxy`.

## Kode

| Berkas                                         | Peran                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `apps/proxy/src/guard.ts`                      | Allowlist, deteksi alamat internal, `assertAllowed()`              |
| `apps/proxy/src/fetcher.ts`                    | Redirect manual + pemeriksaan ulang tiap lompatan, sanitasi header |
| `apps/proxy/src/routes.ts`                     | `/health`, `/fetch`, `/stream`, penerjemah pesan kegagalan         |
| `apps/proxy/src/config.ts`                     | Pembacaan env                                                      |
| `apps/proxy/src/index.ts`                      | Fastify + CORS; memperingatkan kalau allowlist kosong              |
| `apps/proxy/test/guard.test.ts`                | Test gerbang SSRF                                                  |
| `packages/extension-runtime/src/http/proxy.ts` | Sisi klien: `HttpClient` + `MediaResolver`                         |

## Verifikasi

```bash
pnpm dev:proxy
pnpm test                       # test unit gerbang SSRF

curl -s localhost:5181/health
# {"ok":true,"allowedHosts":3}

curl -s -XPOST localhost:5181/fetch -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9/x"}'
# {"error":"Alamat jaringan internal tidak boleh diakses lewat proxy"}

curl -s -XPOST localhost:5181/fetch -H 'content-type: application/json' \
  -d '{"url":"https://example.com/"}'
# {"error":"Host example.com tidak ada di allowlist proxy"}

curl -s -XPOST localhost:5181/fetch -H 'content-type: application/json' \
  -d '{"url":"file:///etc/passwd"}'
# {"error":"Protokol file: tidak diizinkan"}
```

> **Belum terverifikasi:** `/stream` dengan `Range` terhadap CDN sungguhan.
> Dari mesin pengembangan ini tidak ada host di allowlist yang terjangkau.
> Akan ikut terverifikasi di Fase 5 (player) pada jaringan yang normal.
