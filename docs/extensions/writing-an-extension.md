# Menulis Extension Mirai

Mirai tidak membawa satu pun sumber bawaan. Semua sumber — MangaDex, Komikcast,
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
  "pkg": "mangadex",
  "name": "MangaDex",
  "lang": "all",
  "version": "1.0.0",
  "apiVersion": 1,
  "nsfw": false,
  "hosts": ["api.mangadex.org", "uploads.mangadex.org"]
}
```

| Field        | Kegunaan                                                                    |
| ------------ | --------------------------------------------------------------------------- |
| `pkg`        | Nama berkas hasil build (`dist/js/<pkg>.js`) dan kunci di index repo        |
| `apiVersion` | Dicocokkan runtime dengan `API_VERSION`; beda = ditolak dengan pesan jelas  |
| `hosts`      | **Allowlist proxy.** Host di luar daftar ini akan ditolak dengan 403 di web |

`hosts` bukan formalitas: di build web setiap request menempuh `apps/proxy`, dan
proxy menolak host yang tidak terdaftar. Lupa mencantumkan CDN gambar adalah
penyebab paling umum "judulnya muncul tapi cover-nya kosong".

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

Saat `pnpm dev`, `extensions/dist/` disajikan di `/ext-dev` sebagai repo
extension lokal, jadi hasil build langsung muncul di halaman **Browse** tanpa
perlu publish ke mana-mana.

Jangan lupa menambahkan host baru ke `PROXY_ALLOWED_HOSTS` di
`apps/proxy/.env` — daftar itu gagal-tertutup.

---

## Test

Test extension memakai **stub `HttpClient` + fixture**, bukan jaringan sungguhan.
Test yang memanggil situs asli akan merah setiap kali situsnya rewel, dan yang
sebenarnya ingin dibuktikan adalah pemetaan respons → model.

Contoh lengkap: `extensions/test/mangadex.test.ts`.

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
- [ ] `hosts[]` di manifest memuat **semua** domain, termasuk CDN gambar/video
- [ ] Tidak ada `fetch`/`XMLHttpRequest` langsung
- [ ] Field opsional dihilangkan lewat `compact()`, bukan diisi string kosong
- [ ] Ada test dengan fixture
- [ ] `pnpm typecheck && pnpm lint && pnpm test` hijau
