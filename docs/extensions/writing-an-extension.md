# Menulis Extension Mirai

Mirai tidak membawa satu pun sumber bawaan. Semua sumber — Komikcast, Mangabat,
Otakudesu — adalah paket terpisah yang mengimplementasikan satu interface,
dibundel jadi satu berkas ESM, lalu dijalankan di dalam Web Worker terisolasi.
Polanya meniru [keiyoushi](https://github.com/keiyoushi/extensions-source):
source-nya di satu repo, hasil build-nya di repo lain yang dipasang user.

Dokumen ini panduan praktis. Daftar tipe lengkapnya ada di
[api-reference.md](api-reference.md).

---

## Bentuk sebuah extension

```
extensions/src/<lang>/<slug>/
├─ manifest.json
├─ index.ts        ← export default SourceFactory
└─ icon.png        (opsional)
```

`<lang>` adalah `all` untuk source multi-bahasa, atau kode bahasa pendek (`id`,
`en`). Ini cuma pengelompokan folder; yang dibaca aplikasi adalah `manifest.json`.

### `manifest.json`

```json
{
  "pkg": "komikcast",
  "name": "Komikcast",
  "lang": "id",
  "version": "1.0.0",
  "apiVersion": 1,
  "nsfw": false,
  "hosts": ["v3.komikcast.fit", "be.komikcast.cc", "cdn.komikcast.fit"]
}
```

| Field        | Kegunaan                                                                   |
| ------------ | -------------------------------------------------------------------------- |
| `pkg`        | Nama berkas hasil build (`dist/js/<pkg>.js`) dan kunci di index repo       |
| `version`    | SemVer. Dinaikkan tiap perbaikan; itu yang memunculkan tombol **Update**   |
| `apiVersion` | Dicocokkan runtime dengan `API_VERSION`; beda = ditolak dengan pesan jelas |
| `hosts`      | Semua domain yang disentuh paket ini, termasuk CDN gambar dan video        |

`hosts` adalah **deklarasi**, bukan gerbang: proxy tidak lagi memakainya sebagai
allowlist (alasannya di
[network-proxy.md](../features/network-proxy.md#kenapa-tanpa-allowlist)). Yang
memakainya:

- build menolak paket yang `baseUrl`-nya tidak tercakup — penangkap salah ketik;
- pengguna, yang bisa melihat domain apa saja yang akan dihubungi paketmu sebelum
  memasangnya;
- deployment proxy bersama, yang boleh mengaktifkan pembatasan berbasis daftar
  ini.

Tetap tulis lengkap. Daftar yang bohong lebih buruk daripada tidak ada.

Satu entri juga mencakup subdomainnya — `example.com` mencakup `cdn.example.com`,
bukan `notexample.com`. Untuk CDN yang mengganti label domainnya berkala, `*`
mewakili **tepat satu label**:

```json
"hosts": ["otakudesu.blog", "megap.*.top"]
```

`megap.*.top` mencakup `megap.shiora.top` maupun `megap.norami.top`, tapi bukan
`megap.a.b.top` dan bukan `evil.top`.

---

## Extension paling minimal

```ts
import type {
  EntriesPage,
  FilterList,
  MangaSource,
  SChapter,
  SManga,
  SPage,
  SourceContext,
  SourceFactory,
} from '@mirai/extension-api'

class ContohSource implements MangaSource {
  readonly id = 'contoh'
  readonly name = 'Contoh'
  readonly lang = 'id'
  readonly baseUrl = 'https://contoh.test'
  readonly supportsLatest = true
  readonly isNsfw = false
  readonly kind = 'manga' as const

  constructor(private readonly ctx: SourceContext) {}

  async getPopular(page: number): Promise<EntriesPage<SManga>> {
    /* … */
  }
  async getLatest(page: number): Promise<EntriesPage<SManga>> {
    /* … */
  }
  async getSearch(page: number, query: string, filters: FilterList) {
    /* … */
  }
  async getDetails(manga: SManga): Promise<SManga> {
    /* … */
  }
  getFilterList(): FilterList {
    return []
  }
  async getChapterList(manga: SManga): Promise<SChapter[]> {
    /* … */
  }
  async getPageList(chapter: SChapter): Promise<SPage[]> {
    /* … */
  }
}

const factory: SourceFactory = (ctx) => [new ContohSource(ctx)]
export default factory
```

Untuk source berbasis scraping, turunkan dari `ParsedHttpSource` /
`ParsedMangaSource` / `ParsedAnimeSource` di `@mirai/extension-lib` — yang
perlu ditulis tinggal pasangan `xxxRequest()` + `xxxParse()`.

---

## Aturan yang bikin extension awet

### 1. `id` tidak boleh berubah, selamanya

Entri di library user menyimpan `source_id`. Menggantinya membuat semua entri
lama kehilangan sumbernya. Ganti `name` sesuka hati; `id` tidak.

### 2. Jangan pernah `fetch()`

```ts
// ✗ dimatikan di dalam worker — melempar
const res = await fetch(url)

// ✓
const res = await this.ctx.http.get(url)
const data = await this.ctx.http.getJson(url)
```

Host yang memilih transport (`CapacitorHttp` di APK, proxy di web), menerapkan
rate limit, dan menyimpan cookie. Extension tidak perlu tahu yang mana.

### 3. Hilangkan field opsional, jangan isi kosong

```ts
// ✗ <img src=""> memicu error jaringan
return { url, title, thumbnailUrl: cover ?? '' }

// ✓ host menampilkan fallback judul
return compact<SManga>({ url, title, thumbnailUrl: cover, status: 'unknown' })
```

`compact()` membuang properti `undefined` tapi mempertahankan `0`, `''`, dan
`false` yang memang bermakna.

### 4. Perlakukan JSON sebagai `unknown`

`getJson()` sengaja tidak generic. Bacalah dengan helper:

```ts
import { arr, get, num, str } from '@mirai/extension-lib'

const total = num(get(data, 'total')) ?? 0
const title = str(get(item, 'attributes', 'title', 'en'))
for (const item of arr(get(data, 'data'))) { … }
```

`get()` mengembalikan `undefined` saat path putus, bukan melempar — satu field
yang hilang tidak boleh mematikan seluruh daftar.

### 5. Filter tak dikenal diabaikan diam-diam

User bisa membawa filter tersimpan dari versi extension sebelumnya. `findFilter()`
dan kawan-kawannya sudah mengembalikan nilai default untuk key yang tidak ada —
jangan tambahkan `throw` di atasnya.

### 6. Nomor chapter yang tidak ada adalah `undefined`, bukan `0`

Nol mengacaukan pengurutan. `parseNumber()` sudah berperilaku begitu.

### 7. Sebut selector yang gagal di pesan error

Situs sumber akan mengubah markup-nya; itu bukan kemungkinan, itu jadwal. Pesan
`"Selector .chapter-list tidak menemukan apa-apa"` memangkas waktu perbaikan
dari satu jam jadi satu menit.

---

## Filter

```ts
getFilterList(): FilterList {
  return [
    textFilter('author', 'Author'),
    select('status', 'Status', options('semua', 'ongoing', 'completed')),
    group('genre', 'Genre', [triState('action', 'Action'), triState('drama', 'Drama')]),
  ]
}

getSearch(page, query, filters) {
  const author = textValue(filters, 'author')
  const status = selectedOption(filters, 'status')?.value
  const { included, excluded } = triStatePartition(filters, 'genre')
  …
}
```

Host merender daftar itu jadi UI dan mengirimkannya kembali dengan `value`
terisi. Source tidak pernah menyentuh Vue; host tidak pernah tahu query string
source.

---

## Preferences

```ts
class ContohSource implements MangaSource, ConfigurableSource {
  getPreferences(): SourcePreference[] {
    return [
      { type: 'text', key: 'domain', title: 'Domain alternatif', default: this.baseUrl },
      { type: 'switch', key: 'dataSaver', title: 'Hemat kuota', default: false },
    ]
  }

  private get host(): string {
    return this.ctx.preferences.getString('domain', this.baseUrl)
  }
}
```

Pembacaan setelan sinkron; host sudah memuat semuanya sebelum worker jalan.
Berguna untuk situs yang gemar berganti domain.

---

## Build & coba

```bash
pnpm --filter @mirai/extensions build   # → extensions/dist/
pnpm dev                                # http://localhost:5180
pnpm dev:proxy                          # perlu untuk build web
```

Saat `pnpm dev`, `extensions/dist/` disajikan di `/ext-dev` dan **terdaftar
otomatis sebagai repo** di halaman Extension. Tidak ada paket yang dipasang
otomatis: extension yang baru dibangun harus kamu **Pasang** sendiri, persis
seperti yang dilakukan pengguna. Kalau dipasang otomatis, jalur "tambah repo →
pasang → pakai" tidak pernah dicoba selama pengembangan.

Tidak ada daftar host yang perlu disinkronkan di sisi proxy: proxy meneruskan ke
host publik mana pun dan hanya menolak alamat internal. Host baru di manifest
cukup ditulis di manifest.

### Apa yang diperiksa build

`build.ts` tidak sekadar membundel. Tiap bundel hasil esbuild **dijalankan sekali
di proses build** dengan konteks tiruan yang seluruh metode HTTP-nya melempar.
Yang gagal di situ:

- `export default` bukan fungsi, atau factory mengembalikan array kosong
- source tanpa `id` atau `name`
- `baseUrl` yang tidak tercakup `hosts[]` manifest
- `id` source yang sama dipakai dua paket berbeda
- constructor source yang melakukan HTTP — memasang extension tidak boleh
  menembak jaringan sebelum pengguna meminta apa pun

Semuanya kesalahan yang, kalau lolos, baru muncul sebagai layar kosong di HP
pengguna setelah paketnya terlanjur terbit.

### Uji ke situs sungguhan

```bash
node extensions/scripts/smoke.mjs             # semua paket
node extensions/scripts/smoke.mjs komikcast   # satu paket
```

Menjalankan bundel hasil build — lengkap dengan linkedom di dalamnya — langsung
ke situs aslinya: populer → detail → daftar chapter/episode → halaman/video.
**Bukan bagian dari CI**, karena hasilnya bergantung pada situs pihak ketiga yang
bisa mati atau pindah domain. Gunanya menjawab satu pertanyaan yang tidak bisa
dijawab fixture: apakah selector-nya masih cocok dengan markup hari ini.

Untuk jaringan yang memblokir sumber lewat DNS:

```bash
MIRAI_SMOKE_RESOLVE=v3.komikcast.fit=1.2.3.4 node extensions/scripts/smoke.mjs
```

---

## Terbit

`.github/workflows/publish-extensions.yml` membangun `extensions/dist` dan
menerbitkannya ke GitHub Pages setiap kali `extensions/` atau paket
`extension-api`/`extension-lib` berubah. Hasilnya adalah URL repo yang tinggal
ditempel pengguna di halaman **Extension**.

Menaikkan `version` di manifest sudah cukup untuk memunculkan tombol **Update**
di aplikasi; tidak ada langkah rilis lain. Karena kunci cache bundel memuat
versinya, lupa menaikkan `version` berarti perbaikanmu tidak pernah sampai ke
pengguna yang sudah memasang paket itu.

---

## Situs dengan verifikasi Cloudflare

Beberapa sumber menaruh tantangan Cloudflare di depan halamannya. Mirai tidak
menyelesaikannya secara otomatis — bukan karena sulit, tapi karena memutari
tantangan bot adalah pekerjaan yang akan kalah terus dan bikin aplikasi terlihat
seperti scraper. Polanya sama dengan Aniyomi: tantangan itu **diselesaikan
pengguna sendiri**, dan kalau tidak bisa, sumber itu memang tidak bisa dipakai.
Yang jadi tanggung jawab extension cuma satu: gagal dengan pesan yang menyebut
verifikasinya, bukan dengan "gagal mem-parse halaman".

---

## Test

Test extension memakai **stub `HttpClient` + fixture**, bukan jaringan sungguhan.
Test yang memanggil situs asli akan merah setiap kali situsnya rewel, dan yang
sebenarnya ingin dibuktikan adalah pemetaan respons → model.

Taruh berkasnya di `extensions/test/<pkg>.test.ts`; `pnpm test` di root menyapu
`extensions/**/test/**/*.test.ts`.

```ts
const ctx: SourceContext = {
  apiVersion: 1,
  http: { getJson: (url) => Promise.resolve(fixtureFor(url)) /* … */ },
  preferences: createPrefs(),
}
const source = factory(ctx)[0]
expect((await source.getPopular(1)).entries[0]).toEqual({ url: '/manga/abc', title: 'Blue Lock' })
```

Yang layak ditest: pemetaan field, field opsional yang seharusnya hilang,
paginasi sampai habis, terjemahan filter jadi parameter, dan perilaku saat data
cacat.

---

## Checklist sebelum merge

- [ ] `id` unik dan final
- [ ] `version` dinaikkan kalau ini perbaikan untuk paket yang sudah ada
- [ ] `hosts[]` di manifest memuat **semua** domain, termasuk CDN gambar/video
- [ ] Tidak ada `fetch`/`XMLHttpRequest` langsung
- [ ] Field opsional dihilangkan lewat `compact()`, bukan diisi string kosong
- [ ] Ada test dengan fixture
- [ ] `pnpm typecheck && pnpm lint && pnpm test` hijau
- [ ] `pnpm --filter @mirai/extensions build` lolos, dan smoke ke situs asli
      pernah dijalankan sekali
