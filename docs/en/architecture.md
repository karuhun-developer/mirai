# Architecture

> English version of [../architecture.md](../architecture.md). Indonesian is the
> source of truth — when the two disagree, the Indonesian one is right.

## Layers

```
UI (pages/components)
  → Pinia store          (state, no SQL)
    → Service            (orchestration across repositories, one transaction)
      → Repository       (one table, SQL lives only here)
        → Db             (interface; native vs web behind it)
```

**Stores and components never write SQL.** That rule is what keeps a change of
storage driver from leaking into the UI.

Data coming from extensions runs on a parallel path that never touches the DB:

```
UI → store → extension-runtime → Worker (extension code)
                                   → HttpClient (RPC back to the host)
                                     → CapacitorHttp (native) | proxy (web)
```

## Packages

| Package                      | Contents                                          | Why it is separate                                                                                |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/extension-api`     | Contract types + abstract classes                 | Zero dependencies, so its version is stable and old extensions don't break when the toolkit moves |
| `packages/extension-lib`     | HTML parser, HttpClient, filters, video resolvers | Allowed to be heavy — it is bundled into each extension, not into the app                         |
| `packages/extension-runtime` | Loader, Worker sandbox, RPC, repo management      | The only thing that knows how to run foreign code                                                 |
| `packages/db`                | Schema, migrations, repositories                  | The only place SQL exists                                                                         |
| `apps/app`                   | Vue SPA + Capacitor host                          | What gets packaged as the APK                                                                     |
| `apps/proxy`                 | Fastify: `/fetch` + `/stream`                     | Used by web builds only                                                                           |

The original design named two more packages, `packages/core` (library/updates
domain) and `packages/ui` (cross-page components). Neither was **ever created**:
by the time Phase 3 was written, their contents turned out to be a thin layer of
orchestration over the repositories plus components with exactly one consumer.
Moving those into their own packages only adds a build boundary without a second
consumer to justify it. The layering is still enforced, just inside `apps/app`:
`pages/` → `stores/` → `services/` → `@mirai/db` repositories. If a second
consumer ever appears (an extension preview page, say), splitting them out is a
file move.

## Networking

Browsers block cross-origin requests to source sites, and video CDNs often
reject requests without the right `Referer`/`User-Agent`. So `HttpClient` has two
adapters, picked at runtime:

- **Native (APK).** `CapacitorHttp` (enabled in `capacitor.config.ts`) patches
  `fetch`/XHR at the native level. No CORS, any header may be set, and no
  intermediary server is involved.
- **Web.** Every request goes through `apps/proxy`. The proxy stores nothing; it
  forwards bytes, passes `Range` through untouched (required for video), and adds
  CORS headers. Destinations that resolve to internal addresses — loopback,
  private networks, cloud metadata — are refused, and every redirect hop is
  re-checked: an SSRF gate, because the URL is chosen by third-party code. Public
  sites are not restricted by any list; the reasoning is in
  [../features/network-proxy.md](../features/network-proxy.md#kenapa-tanpa-allowlist)
  (Indonesian).

Rate limiting, the cookie jar, and retries live on the host side rather than
inside extensions, so one misbehaving extension cannot flood a source site.

## Extension sandbox

Each extension runs in one Web Worker (`type: 'module'`) and talks over an
`{ id, method, args }` RPC channel. Inside the Worker:

- there is no DOM and no access to application storage;
- the global `fetch` is replaced, so every request returns to the host to be
  decided on and recorded;
- HTML parsing uses `linkedom` — a Worker has no `DOMParser`.

## Storage

Metadata lives in SQLite: `@capacitor-community/sqlite` on native, `jeep-sqlite`

- `sql.js` (wasm → IndexedDB) on web. Raw SQL behind the `Db` interface, no ORM.

Media files are **not** stored in SQLite. Manga pages and video files are written
to the Filesystem on native and OPFS on web; the row in the `download` table only
keeps a path. Putting binaries inside rows makes every write drag megabytes it
does not need.

## Boot

`apps/app/src/main.ts` runs an explicit, ordered sequence. Since Phase 3
`initDb()` runs before Pinia, because stores read the DB as they are created. If
boot fails the app deliberately does not mount half-way — a raw error panel is
more useful than a blank screen.
