# API Reference Extension

Referensi lengkap `@mirai/extension-api` (kontrak) dan `@mirai/extension-lib`
(perkakas). Untuk panduan langkah demi langkah, baca
[writing-an-extension.md](writing-an-extension.md).

**Versi kontrak saat ini: `API_VERSION = 1`.**

---

## Kenapa dua paket

| Paket                  | Isi                                                 | Boleh punya dependensi? |
| ---------------------- | --------------------------------------------------- | ----------------------- |
| `@mirai/extension-api` | Tipe + konstanta + type guard. Tidak ada kode kerja | **Tidak.** Nol.         |
| `@mirai/extension-lib` | Parser HTML, builder filter, base class, util       | Ya, boleh gemuk         |

`extension-api` dijaga tetap kurus supaya versinya jarang naik — setiap
kenaikan `API_VERSION` mematikan semua extension terpasang. `extension-lib`
ikut dibundel ke tiap berkas extension oleh esbuild, jadi ukurannya jadi urusan
extension itu sendiri, bukan urusan aplikasi.

---

## Entry point

Setiap extension `export default` satu fungsi:

```ts
export type SourceFactory = (ctx: SourceContext) => AnySource[]
```

Mengembalikan array karena satu paket lazim membungkus source yang sama untuk
beberapa bahasa.

```ts
export interface SourceContext {
  readonly apiVersion: number
  readonly http: HttpClient
  readonly preferences: PreferenceStore
}
```

`ctx` adalah **satu-satunya** jalan ke dunia luar. Di dalam worker `fetch()`,
`XMLHttpRequest`, dan `importScripts()` sudah dimatikan.

---

## Source

```ts
interface Source {
  readonly id: string // stabil selamanya — lihat catatan di bawah
  readonly name: string
  readonly lang: string // BCP-47 pendek, atau 'all'
  readonly baseUrl: string
  readonly supportsLatest: boolean
  readonly isNsfw: boolean
}
```

> **`id` tidak boleh berubah.** Entri library menyimpan `source_id`; menggantinya
> membuat entri lama kehilangan sumbernya dan tidak bisa di-update lagi.

```ts
interface CatalogueSource<T extends SEntry> extends Source {
  getPopular(page: number): Promise<EntriesPage<T>>
  getLatest(page: number): Promise<EntriesPage<T>>
  getSearch(page: number, query: string, filters: FilterList): Promise<EntriesPage<T>>
  getDetails(entry: T): Promise<T>
  getFilterList(): FilterList
}

interface MangaSource extends CatalogueSource<SManga> {
  readonly kind: 'manga'
  getChapterList(manga: SManga): Promise<SChapter[]>
  getPageList(chapter: SChapter): Promise<SPage[]>
}

interface AnimeSource extends CatalogueSource<SAnime> {
  readonly kind: 'anime'
  getEpisodeList(anime: SAnime): Promise<SEpisode[]>
  getVideoList(episode: SEpisode): Promise<SVideo[]>
}

type AnySource = MangaSource | AnimeSource
```

`kind` adalah diskriminan; host memakai `isMangaSource()` / `isAnimeSource()`
untuk memilah, bukan menebak dari nama.

### Aturan perilaku

- `getSearch` **mengabaikan filter yang tidak dikenal**, tidak melempar. User
  bisa membawa filter tersimpan dari versi extension sebelumnya.
- `getChapterList` boleh mengembalikan urutan bebas; host yang mengurutkan
  berdasarkan `chapterNumber`.
- `getVideoList` menaruh pilihan terbaik di indeks 0 — itu yang dipakai player
  sebagai default.
- `getDetails` menerima dan mengembalikan bentuk yang sama; ia melengkapi, bukan
  mengganti.

### Setelan per source

```ts
interface ConfigurableSource {
  getPreferences(): SourcePreference[]
}
```

Opsional. Host mendeteksinya lewat `isConfigurable(source)` — yang memeriksa
`typeof source.getPreferences === 'function'`, jadi properti bernama sama yang
bukan fungsi tidak lolos.

---

## Model data

```ts
interface SEntry {
  url: string // relatif terhadap baseUrl; jadi identitas entri
  title: string
  thumbnailUrl?: string
}

interface SManga extends SEntry {
  author?: string
  artist?: string
  description?: string
  genre?: string[]
  status: SStatus // 'unknown' | 'ongoing' | 'completed' | 'hiatus' | 'cancelled'
}

interface SAnime extends SEntry {
  /* sama, ditambah totalEpisodes?, studio? */
}

interface SChapter {
  url: string
  name: string
  chapterNumber?: number
  dateUpload?: number // epoch ms
  scanlator?: string
}

interface SEpisode {
  url: string
  name: string
  episodeNumber?: number
  dateUpload?: number
  filler?: boolean
}

interface SPage {
  index: number
  imageUrl: string
  headers?: HttpHeaders // Referer/UA untuk CDN yang rewel
}

interface SVideo {
  url: string
  quality: string
  type: 'hls' | 'mp4' | 'dash'
  headers?: HttpHeaders
  subtitles?: STrack[]
  audios?: STrack[]
}

interface EntriesPage<T extends SEntry> {
  entries: T[]
  hasNextPage: boolean
}
```

**Field opsional dihilangkan, bukan diisi kosong.** `thumbnailUrl: ''` membuat
`<img>` mencoba memuat URL kosong; ketiadaan properti membuat host menampilkan
fallback judul. Pakai `compact()` dari `extension-lib` untuk ini.

---

## HTTP

```ts
interface HttpClient {
  request(req: HttpRequest): Promise<HttpResponse>
  get(url: string, headers?: HttpHeaders): Promise<HttpResponse>
  post(url: string, body: string, headers?: HttpHeaders): Promise<HttpResponse>
  getJson(url: string, headers?: HttpHeaders): Promise<unknown>
}
```

`getJson()` mengembalikan `unknown`, bukan generic. Respons berasal dari
jaringan; `getJson<Manga>()` cuma kebohongan tipe yang berubah jadi crash saat
situsnya mengubah bentuk. Pakai helper di [`json.ts`](#json) untuk membacanya.

`HttpError` membawa `status` dan `url`, jadi host bisa membedakan "judul ini
404" dari "situsnya mati".

Request dieksekusi **host**, bukan worker. Host yang memilih transport
(`CapacitorHttp` di APK, proxy di web), menerapkan rate limit, dan menyimpan
cookie.

---

## Filter

Source mendeklarasikan filter; host merendernya jadi UI dan mengirim balik
daftar yang sama dengan `value` terisi. Source tidak pernah menyentuh Vue, host
tidak pernah tahu query string source.

| Tipe        | `value`                        | Kegunaan                           |
| ----------- | ------------------------------ | ---------------------------------- |
| `header`    | —                              | Judul kelompok                     |
| `separator` | —                              | Garis pemisah                      |
| `text`      | `string`                       | Author, tahun                      |
| `checkbox`  | `boolean`                      | Saklar tunggal                     |
| `tristate`  | `0` \| `1` \| `2`              | Genre: abaikan/sertakan/kecualikan |
| `select`    | `number` (indeks ke `options`) | Status, urutan                     |
| `sort`      | `{ index, ascending }`         | Urutan dua arah                    |
| `group`     | `filters: Filter[]`            | Wadah, boleh bersarang             |

`TriState = { Ignore: 0, Include: 1, Exclude: 2 }` — angkanya tersimpan di
preferensi user, jadi tidak boleh digeser.

### Builder & reader (`extension-lib`)

```ts
// Membangun
header(key, name)
separator(key)
textFilter(key, name, placeholder?)
checkbox(key, name, value?)
triState(key, name, value?)
select(key, name, options, value?)
sort(key, name, options, index?, ascending?)
group(key, name, filters)
options('populer', 'terbaru') // → FilterOption[]; label = value

// Membaca — semua menerima FilterList dan key, aman untuk key tak dikenal
findFilter(list, key) // menelusuri ke dalam group; undefined kalau tidak ada
selectedOption(list, key) // FilterOption | undefined
textValue(list, key) // '' kalau tidak ada
checkboxValue(list, key) // false kalau tidak ada
triStatePartition(list, key) // { included: string[], excluded: string[] }
```

---

## Preferences

```ts
type SourcePreference = TextPreference | SwitchPreference | ListPreference | MultiSelectPreference

interface PreferenceStore {
  getString(key: string, fallback: string): string
  getBoolean(key: string, fallback: boolean): boolean
  getStringList(key: string, fallback: readonly string[]): string[]
}
```

Pembacaan **sinkron**, sengaja: source memanggilnya di tengah pembentukan
request, dan `await` di setiap pembacaan cuma menambah titik gagal. Host sudah
memuat seluruh setelan sebelum worker dijalankan.

`ListPreference.values` sejajar dengan `entries`; yang disimpan adalah `values`.

---

## `ParsedHttpSource` (extension-lib)

Base class untuk source berbasis scraping HTML. Yang perlu ditulis cuma pasangan
request/parse:

```ts
abstract popularRequest(page: number): HttpRequest
abstract popularParse(doc: MDocument, res: HttpResponse): EntriesPage<T>
abstract searchRequest(page: number, query: string, filters: FilterList): HttpRequest
abstract searchParse(doc: MDocument, res: HttpResponse): EntriesPage<T>
abstract detailsParse(doc: MDocument, entry: T): T
```

`latestRequest()` default-nya melempar, dan `latestParse()` default-nya
mendelegasikan ke `popularParse` — kebanyakan situs memakai markup yang sama
untuk kedua daftar. Kalau `supportsLatest: false`, tidak perlu di-override sama
sekali.

Turunannya:

- **`ParsedMangaSource`** menambah `chapterListParse`, `pageListParse`.
- **`ParsedAnimeSource`** menambah `episodeListParse`, dan `videoListParse` yang
  **async** — halaman episode hampir selalu butuh satu lompatan lagi untuk
  membongkar iframe pemutar.

Tersedia untuk turunan: `this.http`, `this.prefs`, `headers()`, `get(path)`,
`fetchDocument(req)`.

Source berbasis API (seperti MangaDex) tidak perlu base class ini —
`implements MangaSource` langsung lebih jujur.

---

## Helper HTML

`linkedom` dipakai sebagai parser karena Web Worker tidak punya `DOMParser`.
Tipenya sengaja diciutkan jadi `MDocument`/`MElement` — cukup `querySelector`,
`querySelectorAll`, `getAttribute`, `textContent`, `innerHTML` — supaya kode
extension tidak menyandarkan diri pada seluruh lib.dom.

```ts
parseHtml(html) // → MDocument
selectAll(root, selector) // → MElement[] (array biasa, bukan NodeList)
text(el) // textContent yang whitespace-nya dirapikan; '' kalau null
textOf(root, selector) // text(root.querySelector(selector))
attr(el, name) // '' kalau null
attrOf(root, selector, name)
imageSrc(el) // melewati placeholder `data:`; mencoba data-src, data-lazy-src,
// data-original, lalu src
absoluteUrl(base, href) // href apa adanya kalau base tidak valid, tidak melempar
```

---

## Helper JSON {#json}

Untuk membaca respons `unknown` tanpa cast:

```ts
isRecord(value)
get(value, 'data', 0, 'attributes') // menelusuri path; undefined kalau putus
str(value, fallback?) // '' kalau bukan string
num(value) // undefined kalau bukan angka atau NaN
bool(value, fallback?)
arr(value) // [] kalau bukan array
strList(value) // menyaring elemen non-string
```

---

## Util

```ts
DEFAULT_USER_AGENT
refererHeaders(url) // { Referer, User-Agent } untuk CDN yang memeriksanya
query({ limit: 20, title: '' }) // '?limit=20' — parameter kosong dibuang
parseNumber('Chapter 12,5') // 12.5; undefined untuk 'Oneshot', bukan 0
parseIsoDate('2024-05-01T00:00:00Z') // epoch ms; undefined kalau cacat
mapLimit(items, limit, fn) // paralel terbatas, urutan hasil dijaga
compact({ a: 1, b: undefined }) // { a: 1 } — falsy yang sah (0, '', false) tetap
```

`parseNumber` mengembalikan `undefined`, bukan `0`, untuk judul tanpa angka:
nol akan mengacaukan pengurutan, sedangkan `undefined` memberi tahu host supaya
memakai urutan asli dari source.

---

## Index repo (`index.min.json`)

Bentuk yang dihasilkan `extensions/scripts/build.ts` dan dibaca aplikasi saat
sebuah repo ditambahkan. Ini kontrak juga — aplikasi memakainya untuk menampilkan
paket **sebelum** kodenya diunduh.

```ts
interface RepoEntry {
  pkg: string // = nama berkas: `js/<pkg>.js`
  name: string
  lang: string
  version: string // SemVer; naiknya memunculkan tombol Update
  apiVersion: number
  nsfw: boolean
  hosts: string[] // domain yang disentuh paket; deklarasi, bukan gerbang
  file: string // relatif terhadap URL repo
  icon?: string // idem; SVG didahulukan
  sources: RepoSourceInfo[]
}

interface RepoSourceInfo {
  id: string
  name: string
  lang: string
  kind: 'manga' | 'anime'
  baseUrl: string
  supportsLatest: boolean
  nsfw: boolean // `isNsfw` source, di-OR dengan `nsfw` paket
}
```

`sources[]` **tidak** ditulis tangan di manifest: build menjalankan factory sekali
dengan preferensi bawaan lalu membaca sendiri source yang dihasilkan. Jadi
isinya dijamin sama dengan yang nanti benar-benar berjalan, dan `baseUrl` di sini
adalah domain default source.

Aplikasi memvalidasi ulang seluruh index sebelum menyimpannya
(`services/extensionRepo.service.ts`): server repo adalah pihak luar, dan
`apiVersion` berupa teks atau `hosts` kosong ditolak dengan menyebut paket mana
yang bermasalah. Lihat
[docs/features/extension-manager.md](../features/extension-manager.md).

### Daur hidup `apiVersion`

`apiVersion` dicek **sebelum** bundel diunduh, dan ketidakcocokan mana pun
menolak pemasangan — arahnya dibedakan supaya pengguna tahu siapa yang harus
di-update: "Butuh Mirai yang lebih baru" versus "Extension usang".

Menaikkan `API_VERSION` mematikan **semua** extension terpasang sekaligus, jadi
tambahan yang tidak merusak (field opsional baru di model, helper baru di
`extension-lib`) tidak menaikkannya. Yang menaikkan: menghapus atau mengubah arti
anggota yang sudah ada di `@mirai/extension-api`.

---

## Batas sandbox

Yang **tidak ada** di dalam worker:

- `fetch`, `XMLHttpRequest`, `importScripts` — dimatikan setelah modul dimuat
- DOM, `window`, `document`, `localStorage`
- Akses ke database aplikasi
- Modul Node

Yang ada: `ctx.http`, `ctx.preferences`, `URL`, `URLSearchParams`, `JSON`,
`TextDecoder`, dan seluruh built-in ES2022.
