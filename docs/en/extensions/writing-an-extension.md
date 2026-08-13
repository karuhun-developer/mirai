# Writing a Mirai Extension

> English version of
> [../../extensions/writing-an-extension.md](../../extensions/writing-an-extension.md).
> Indonesian is the source of truth — when the two disagree, the Indonesian one
> is right.

Mirai ships with no sources of its own. Every source — Komikcast, Mangabat,
Otakudesu — is a separate package that implements one interface, is bundled into
a single ESM file, and runs inside an isolated Web Worker. The pattern follows
[keiyoushi](https://github.com/keiyoushi/extensions-source): sources in one repo,
build output in another that users install from.

This is the practical guide. The full type listing is in
[api-reference.md](api-reference.md).

---

## Shape of an extension

```
extensions/src/<lang>/<slug>/
├─ manifest.json
├─ index.ts        ← export default SourceFactory
└─ icon.png        (optional)
```

`<lang>` is `all` for multi-language sources, or a short language code (`id`,
`en`). It is only folder grouping; what the app reads is `manifest.json`.

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

| Field        | What it is for                                                              |
| ------------ | --------------------------------------------------------------------------- |
| `pkg`        | Build output filename (`dist/js/<pkg>.js`) and the key in the repo index    |
| `version`    | SemVer. Bumped on every fix; that is what surfaces the **Update** button    |
| `apiVersion` | Matched by the runtime against `API_VERSION`; a mismatch is rejected loudly |
| `hosts`      | Every domain this package touches, including image and video CDNs           |

`hosts` is a **declaration**, not a gate: the proxy no longer uses it as an
allowlist (reasoning in
[../../features/network-proxy.md](../../features/network-proxy.md#kenapa-tanpa-allowlist),
Indonesian). What does use it:

- the build rejects a package whose `baseUrl` is not covered — a typo catcher;
- users, who can see which domains your package will contact before installing
  it;
- shared proxy deployments, which may switch on list-based restrictions.

Write it out in full anyway. A list that lies is worse than no list.

One entry covers its subdomains too — `example.com` covers `cdn.example.com`, not
`notexample.com`. For CDNs that rotate a domain label periodically, `*` stands
for **exactly one label**:

```json
"hosts": ["otakudesu.blog", "megap.*.top"]
```

`megap.*.top` covers both `megap.shiora.top` and `megap.norami.top`, but not
`megap.a.b.top` and not `evil.top`.

---

## The smallest possible extension

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

class ExampleSource implements MangaSource {
  readonly id = 'example'
  readonly name = 'Example'
  readonly lang = 'id'
  readonly baseUrl = 'https://example.test'
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

const factory: SourceFactory = (ctx) => [new ExampleSource(ctx)]
export default factory
```

For scraping sources, extend `ParsedHttpSource` / `ParsedMangaSource` /
`ParsedAnimeSource` from `@mirai/extension-lib` — then all you write is
`xxxRequest()` + `xxxParse()` pairs.

---

## Rules that keep an extension alive

### 1. `id` may never change, ever

Entries in a user's library store `source_id`. Changing it orphans every existing
entry. Rename `name` as much as you like; `id` is fixed.

### 2. Never call `fetch()`

```ts
// ✗ disabled inside the worker — throws
const res = await fetch(url)

// ✓
const res = await this.ctx.http.get(url)
const data = await this.ctx.http.getJson(url)
```

The host picks the transport (`CapacitorHttp` in the APK, the proxy on web),
applies rate limits, and keeps cookies. An extension does not need to know which.

### 3. Omit optional fields instead of filling them with empties

```ts
// ✗ <img src=""> triggers a network error
return { url, title, thumbnailUrl: cover ?? '' }

// ✓ the host renders a title fallback
return compact<SManga>({ url, title, thumbnailUrl: cover, status: 'unknown' })
```

`compact()` drops `undefined` properties while keeping `0`, `''`, and `false`,
which are meaningful values.

### 4. Treat JSON as `unknown`

`getJson()` is deliberately not generic. Read it through the helpers:

```ts
import { arr, get, num, str } from '@mirai/extension-lib'

const total = num(get(data, 'total')) ?? 0
const title = str(get(item, 'attributes', 'title', 'en'))
for (const item of arr(get(data, 'data'))) { … }
```

`get()` returns `undefined` when the path breaks rather than throwing — one
missing field must not kill an entire list.

### 5. Unknown filters are ignored silently

Users can carry saved filters over from an older version of your extension.
`findFilter()` and friends already return defaults for missing keys — do not add
a `throw` on top.

### 6. A missing chapter number is `undefined`, not `0`

Zero wrecks sorting. `parseNumber()` already behaves this way.

### 7. Name the failing selector in the error message

Source sites will change their markup; that is not a possibility, it is a
schedule. The message `"Selector .chapter-list found nothing"` cuts repair time
from an hour to a minute.

---

## Filters

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

The host renders that list as UI and sends it back with `value` filled in. The
source never touches Vue; the host never learns the source's query string.

---

## Preferences

```ts
class ExampleSource implements MangaSource, ConfigurableSource {
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

Reading preferences is synchronous; the host loads them all before the worker
starts. Handy for sites that like to change domains.

---

## Build and try it

```bash
pnpm --filter @mirai/extensions build   # → extensions/dist/
pnpm dev                                # http://localhost:5180
pnpm dev:proxy                          # required for web builds
```

Under `pnpm dev`, `extensions/dist/` is served at `/ext-dev` and **registered
automatically as a repo** on the Extensions page. No package is installed
automatically: a freshly built extension is one you **Install** yourself, exactly
as a user would. Auto-installing it would mean the "add repo → install → use"
path never gets exercised during development.

There is no host list to keep in sync on the proxy side: the proxy forwards to
any public host and only refuses internal addresses. A new host in a manifest is
written in the manifest, and that is all.

### What the build checks

`build.ts` does more than bundle. Every esbuild output is **executed once during
the build** against a mock context whose HTTP methods all throw. What fails
there:

- `export default` is not a function, or the factory returns an empty array
- a source without `id` or `name`
- a `baseUrl` not covered by the manifest's `hosts[]`
- the same source `id` used by two different packages
- a source constructor that performs HTTP — installing an extension must not hit
  the network before the user asks for anything

Every one of those, if it slipped through, would first show up as a blank screen
on a user's phone after the package had already shipped.

### Testing against the real site

```bash
node extensions/scripts/smoke.mjs             # every package
node extensions/scripts/smoke.mjs komikcast   # one package
```

This runs the built bundle — linkedom included — straight against the live site:
popular → details → chapter/episode list → pages/video. It is **not part of CI**,
because the result depends on third-party sites that can go down or move domains.
It answers the one question fixtures cannot: do the selectors still match today's
markup.

For networks that block sources at the DNS level:

```bash
MIRAI_SMOKE_RESOLVE=v3.komikcast.fit=1.2.3.4 node extensions/scripts/smoke.mjs
```

---

## Publishing

`.github/workflows/publish-extensions.yml` builds `extensions/dist` and publishes
it to GitHub Pages whenever `extensions/` or the `extension-api`/`extension-lib`
packages change. The result is a repo URL users paste into the **Extensions**
page.

Bumping `version` in the manifest is enough to surface the **Update** button in
the app; there is no other release step. Because the bundle cache key contains
the version, forgetting to bump it means your fix never reaches anyone who
already installed the package.

---

## Sites behind a Cloudflare challenge

Some sources put a Cloudflare challenge in front of their pages. Mirai does not
solve it automatically — not because it is hard, but because working around bot
challenges is a fight you lose continuously and it makes the app look like a
scraper. The pattern matches Aniyomi's: the challenge is **solved by the user**,
and if they cannot, that source simply cannot be used.

Telling a challenge apart from an ordinary 403 is the host's job, not the
extension's: the transport inspects every response and throws
`CloudflareChallengeError` before the challenge HTML can reach a parser. So there
is **nothing to write** in an extension for this — do not catch a 403 and guess.
Details in [../../features/cloudflare.md](../../features/cloudflare.md)
(Indonesian).

---

## Tests

Extension tests use a **stubbed `HttpClient` + fixtures**, not the live network.
A test that calls the real site goes red every time that site misbehaves, and
what you actually want to prove is the response → model mapping.

Put files in `extensions/test/<pkg>.test.ts`; `pnpm test` at the root sweeps
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

Worth testing: field mapping, optional fields that should be absent, pagination
to the end, filters translated into parameters, and behaviour on malformed data.

---

## Checklist before merging

- [ ] `id` is unique and final
- [ ] `version` bumped if this fixes an existing package
- [ ] the manifest's `hosts[]` lists **every** domain, image/video CDNs included
- [ ] no direct `fetch`/`XMLHttpRequest`
- [ ] optional fields dropped via `compact()`, not filled with empty strings
- [ ] there are fixture-based tests
- [ ] `pnpm typecheck && pnpm lint && pnpm test` are green
- [ ] `pnpm --filter @mirai/extensions build` passes, and the live-site smoke has
      been run at least once
