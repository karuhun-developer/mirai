# Extension API Reference

> English version of
> [../../extensions/api-reference.md](../../extensions/api-reference.md).
> Indonesian is the source of truth — when the two disagree, the Indonesian one
> is right.

The complete reference for `@mirai/extension-api` (the contract) and
`@mirai/extension-lib` (the toolkit). For a step-by-step guide, read
[writing-an-extension.md](writing-an-extension.md).

**Current contract version: `API_VERSION = 1`.**

---

## Why two packages

| Package                | Contents                                          | May have dependencies? |
| ---------------------- | ------------------------------------------------- | ---------------------- |
| `@mirai/extension-api` | Types + constants + type guards. No working code  | **No.** Zero.          |
| `@mirai/extension-lib` | HTML parser, filter builders, base classes, utils | Yes, it may be heavy   |

`extension-api` is kept thin so its version rarely moves — every `API_VERSION`
bump kills every installed extension at once. `extension-lib` is bundled into
each extension file by esbuild, so its size is that extension's problem, not the
app's.

---

## Entry point

Every extension `export default`s a single function:

```ts
export type SourceFactory = (ctx: SourceContext) => AnySource[]
```

It returns an array because one package commonly wraps the same source for
several languages.

```ts
export interface SourceContext {
  readonly apiVersion: number
  readonly http: HttpClient
  readonly preferences: PreferenceStore
}
```

`ctx` is the **only** way out to the world. Inside the worker, `fetch()`,
`XMLHttpRequest`, and `importScripts()` are already disabled.

---

## Source

```ts
interface Source {
  readonly id: string // stable forever — see the note below
  readonly name: string
  readonly lang: string // short BCP-47, or 'all'
  readonly baseUrl: string
  readonly supportsLatest: boolean
  readonly isNsfw: boolean
}
```

> **`id` may never change.** Library entries store `source_id`; changing it
> orphans existing entries from their source and they can never be updated again.

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

`kind` is the discriminant; the host uses `isMangaSource()` / `isAnimeSource()`
to tell them apart rather than guessing from the name.

### Behavioural rules

- `getSearch` **ignores unknown filters** instead of throwing. Users can carry
  saved filters over from an earlier version of the extension.
- `getChapterList` may return any order; the host sorts by `chapterNumber`.
- `getVideoList` puts the best choice at index 0 — that is what the player uses
  as its default.
- `getDetails` takes and returns the same shape; it fills in, it does not replace.

### Per-source settings

```ts
interface ConfigurableSource {
  getPreferences(): SourcePreference[]
}
```

Optional. The host detects it with `isConfigurable(source)`, which checks
`typeof source.getPreferences === 'function'`, so a same-named property that is
not a function does not pass.

---

## Data model

```ts
interface SEntry {
  url: string // relative to baseUrl; this is the entry's identity
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
  /* the same, plus totalEpisodes?, studio? */
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
  headers?: HttpHeaders // Referer/UA for picky CDNs
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

**Optional fields are omitted, not filled with empties.** `thumbnailUrl: ''`
makes `<img>` try to load an empty URL; an absent property makes the host render
a title fallback. Use `compact()` from `extension-lib` for this.

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

`getJson()` returns `unknown`, not a generic. The response comes off the network;
`getJson<Manga>()` is just a type-level lie that turns into a crash the day the
site changes shape. Read it with the helpers in [`json.ts`](#json).

`HttpError` carries `status` and `url`, so the host can tell "this title 404s"
apart from "the site is down".

Requests are executed by the **host**, not the worker. The host picks the
transport (`CapacitorHttp` in the APK, the proxy on web), applies rate limits, and
stores cookies.

---

## Filters

A source declares its filters; the host renders them as UI and sends the same
list back with `value` filled in. The source never touches Vue, the host never
learns the source's query string.

| Type        | `value`                         | What it is for                |
| ----------- | ------------------------------- | ----------------------------- |
| `header`    | —                               | Group heading                 |
| `separator` | —                               | Divider line                  |
| `text`      | `string`                        | Author, year                  |
| `checkbox`  | `boolean`                       | A single toggle               |
| `tristate`  | `0` \| `1` \| `2`               | Genre: ignore/include/exclude |
| `select`    | `number` (index into `options`) | Status, ordering              |
| `sort`      | `{ index, ascending }`          | Two-way ordering              |
| `group`     | `filters: Filter[]`             | A container, may nest         |

`TriState = { Ignore: 0, Include: 1, Exclude: 2 }` — those numbers are stored in
user preferences, so they must never be shifted.

### Builders & readers (`extension-lib`)

```ts
// Building
header(key, name)
separator(key)
textFilter(key, name, placeholder?)
checkbox(key, name, value?)
triState(key, name, value?)
select(key, name, options, value?)
sort(key, name, options, index?, ascending?)
group(key, name, filters)
options('populer', 'terbaru') // → FilterOption[]; label = value

// Reading — all take a FilterList and a key, safe for unknown keys
findFilter(list, key) // descends into groups; undefined when absent
selectedOption(list, key) // FilterOption | undefined
textValue(list, key) // '' when absent
checkboxValue(list, key) // false when absent
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

Reads are **synchronous**, deliberately: a source calls them in the middle of
building a request, and an `await` on every read only adds a failure point. The
host has already loaded every setting before the worker runs.

`ListPreference.values` is parallel to `entries`; what gets stored is `values`.

---

## `ParsedHttpSource` (extension-lib)

The base class for HTML-scraping sources. All you have to write is the
request/parse pairs:

```ts
abstract popularRequest(page: number): HttpRequest
abstract popularParse(doc: MDocument, res: HttpResponse): EntriesPage<T>
abstract searchRequest(page: number, query: string, filters: FilterList): HttpRequest
abstract searchParse(doc: MDocument, res: HttpResponse): EntriesPage<T>
abstract detailsParse(doc: MDocument, entry: T): T
```

`latestRequest()` throws by default, and `latestParse()` delegates to
`popularParse` by default — most sites use the same markup for both lists. With
`supportsLatest: false` neither needs overriding at all.

Its subclasses:

- **`ParsedMangaSource`** adds `chapterListParse`, `pageListParse`.
- **`ParsedAnimeSource`** adds `episodeListParse`, and a `videoListParse` that is
  **async** — an episode page almost always needs one more hop to unpack the
  player iframe.

Available to subclasses: `this.http`, `this.prefs`, `headers()`, `get(path)`,
`fetchDocument(req)`.

JSON-API sources do not need this base class — `implements MangaSource` directly
is more honest.

---

## HTML helpers

`linkedom` is the parser, because a Web Worker has no `DOMParser`. Its types are
deliberately narrowed to `MDocument`/`MElement` — just `querySelector`,
`querySelectorAll`, `getAttribute`, `textContent`, `innerHTML` — so extension
code does not lean on all of lib.dom.

```ts
parseHtml(html) // → MDocument
selectAll(root, selector) // → MElement[] (a plain array, not a NodeList)
text(el) // textContent with whitespace tidied; '' when null
textOf(root, selector) // text(root.querySelector(selector))
attr(el, name) // '' when null
attrOf(root, selector, name)
imageSrc(el) // skips `data:` placeholders; tries data-src, data-lazy-src,
// data-original, then src
absoluteUrl(base, href) // href as-is when base is invalid; never throws
```

---

## JSON helpers {#json}

For reading an `unknown` response without casting:

```ts
isRecord(value)
get(value, 'data', 0, 'attributes') // walks a path; undefined when it breaks
str(value, fallback?) // '' when not a string
num(value) // undefined when not a number, or NaN
bool(value, fallback?)
arr(value) // [] when not an array
strList(value) // filters out non-string elements
```

---

## Utils

```ts
DEFAULT_USER_AGENT
refererHeaders(url) // { Referer, User-Agent } for CDNs that check them
query({ limit: 20, title: '' }) // '?limit=20' — empty parameters are dropped
parseNumber('Chapter 12,5') // 12.5; undefined for 'Oneshot', not 0
parseIsoDate('2024-05-01T00:00:00Z') // epoch ms; undefined when malformed
mapLimit(items, limit, fn) // bounded parallelism, result order preserved
compact({ a: 1, b: undefined }) // { a: 1 } — meaningful falsy (0, '', false) stays
```

`parseNumber` returns `undefined`, not `0`, for titles with no number in them:
zero would wreck sorting, while `undefined` tells the host to keep the source's
original order.

---

## Repo index (`index.min.json`)

The shape `extensions/scripts/build.ts` produces and the app reads when a repo is
added. This is a contract too — the app uses it to show a package **before** its
code is downloaded.

```ts
interface RepoEntry {
  pkg: string // = the file name: `js/<pkg>.js`
  name: string
  lang: string
  version: string // SemVer; bumping it surfaces the Update button
  apiVersion: number
  nsfw: boolean
  hosts: string[] // domains the package touches; a declaration, not a gate
  file: string // relative to the repo URL
  icon?: string // ditto; SVG wins
  sources: RepoSourceInfo[]
}

interface RepoSourceInfo {
  id: string
  name: string
  lang: string
  kind: 'manga' | 'anime'
  baseUrl: string
  supportsLatest: boolean
  nsfw: boolean // the source's `isNsfw`, OR-ed with the package's `nsfw`
}
```

`sources[]` is **not** hand-written in the manifest: the build runs the factory
once with default preferences and reads the resulting sources itself. So its
contents are guaranteed to match what will actually run, and the `baseUrl` here is
the source's default domain.

The app re-validates the whole index before storing it
(`services/extensionRepo.service.ts`): a repo server is an outside party, and a
text `apiVersion` or an empty `hosts` is rejected while naming the offending
package. See
[../../features/extension-manager.md](../../features/extension-manager.md)
(Indonesian).

### `apiVersion` lifecycle

`apiVersion` is checked **before** the bundle is downloaded, and any mismatch
refuses the install — the direction is distinguished so the user knows who needs
updating: "Needs a newer Mirai" versus "Extension out of date".

Bumping `API_VERSION` kills **every** installed extension at once, so
non-breaking additions (a new optional field on a model, a new helper in
`extension-lib`) do not bump it. What does: removing or changing the meaning of an
existing member of `@mirai/extension-api`.

---

## Sandbox boundary

What is **not** there inside the worker:

- `fetch`, `XMLHttpRequest`, `importScripts` — disabled once the module is loaded
- the DOM, `window`, `document`, `localStorage`
- access to the application database
- Node modules

What is: `ctx.http`, `ctx.preferences`, `URL`, `URLSearchParams`, `JSON`,
`TextDecoder`, and every ES2022 built-in.
