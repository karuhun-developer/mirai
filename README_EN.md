# Mirai

> English version of [README.md](README.md). Indonesian is the source of truth —
> when the two disagree, the Indonesian one is right.

A manga reader and anime player built around an **extension** system — Mirai
ships with no content sources of its own. Catalogues come from extensions you
install yourself from a repo of your choosing, following the pattern set by
[Aniyomi](https://github.com/aniyomiorg/aniyomi) and
[keiyoushi/extensions](https://github.com/keiyoushi/extensions).

Web-first, mobile-first, and packageable as an APK through Capacitor. Library,
history, and reading/watching progress live in a local SQLite database, so they
stay available with no connection. Reading and watching still need one **unless**
the chapter or episode has been downloaded.

**Stack** — Vue 3 · Vite 8 · TypeScript · Tailwind v4 · shadcn-vue (reka-ui) ·
Pinia · Capacitor 8 · SQLite · pnpm workspaces

## Running it

```bash
pnpm install
cp apps/proxy/.env.example apps/proxy/.env

pnpm --filter @mirai/extensions build   # extensions → extensions/dist
pnpm dev                                # http://localhost:5180
pnpm dev:proxy                          # http://127.0.0.1:5181, in another terminal
```

In web builds every extension request goes through the proxy, so without
`pnpm dev:proxy` the Browse page lists its sources but cannot fetch a catalogue.
The built extensions are served at `/ext-dev` as a local repo during development.

| Command                             | What it does                                     |
| ----------------------------------- | ------------------------------------------------ |
| `pnpm dev`                          | App dev server (port 5180, `strictPort`)         |
| `pnpm dev:proxy`                    | CORS + streaming proxy for web builds            |
| `pnpm build`                        | Build the whole workspace                        |
| `pnpm typecheck`                    | `vue-tsc` across the workspace                   |
| `pnpm lint` / `pnpm lint:fix`       | ESLint                                           |
| `pnpm format` / `pnpm format:check` | Prettier                                         |
| `pnpm test`                         | Vitest                                           |
| `node scripts/smoke.mjs`            | Playwright smoke test (needs `pnpm dev` running) |

## Layout

```
apps/app         Vue SPA + Capacitor host — this is what becomes the APK
apps/proxy       CORS/streaming proxy for web builds
packages/
  extension-api      The extension contract. Zero dependencies.
  extension-lib      Extension author toolkit (parser, http, resolvers)
  extension-runtime  Loader + Worker sandbox + repo management
  db                 SQLite schema, migrations, repositories
extensions       Bundled source extensions + repo build script
```

Why it is split this way: [docs/en/architecture.md](docs/en/architecture.md).

## Android build

APKs are built by GitHub Actions, not locally: cut a Release tagged `vX.Y.Z` and
`mirai-X.Y.Z.apk` shows up attached to it a few minutes later. The version comes
from the tag (`versionCode = X*10000 + Y*100 + Z`).

```bash
pnpm cap:sync      # web build + copy into apps/app/android
pnpm android:open  # sync, then open Android Studio (WSL helper)
pnpm android:icons # redraw icons & splash
```

All three need the Android SDK, which is not installed on the development
machine — so **the APK has never been tested on physical hardware**. The details,
including why the debug keystore is committed and why external pages open in the
app's own WebView, are in
[docs/features/android.md](docs/features/android.md) (Indonesian).

## Roadmap

| Phase | Contents                                         | Status |
| ----- | ------------------------------------------------ | ------ |
| 0     | Monorepo foundation, layout shell, tooling       | ✅     |
| 1     | Extension API, sandbox runtime, proxy            | ✅     |
| 2     | Extension repos, management, Komikcast/Otakudesu | ✅     |
| 3     | SQLite, offline-first Library, Updates           | ✅     |
| 4     | Manga reader (paged + webtoon)                   | ✅     |
| 5     | Anime player                                     | ✅     |
| 6     | Manga downloads                                  | ✅     |
| 7     | Anime downloads (mp4 + HLS)                      | ✅     |
| 8     | Android build (APK)                              | ✅     |
| 9     | Backup, tracker, polish                          | ✅     |

Per-phase detail: [docs/roadmap.md](docs/roadmap.md) (Indonesian).

## Documentation

| Document                                                                                 | Contents                               |
| ---------------------------------------------------------------------------------------- | -------------------------------------- |
| [docs/en/README.md](docs/en/README.md)                                                   | English documentation map              |
| [docs/en/architecture.md](docs/en/architecture.md)                                       | Layers, data flow, networking, storage |
| [docs/en/conventions.md](docs/en/conventions.md)                                         | Coding rules every change follows      |
| [docs/en/extensions/writing-an-extension.md](docs/en/extensions/writing-an-extension.md) | Step-by-step extension guide           |
| [docs/en/extensions/api-reference.md](docs/en/extensions/api-reference.md)               | Full type and helper reference         |
| [docs/features/](docs/features/)                                                         | One document per feature (Indonesian)  |
| [CHANGELOG.md](CHANGELOG.md)                                                             | Release history (Indonesian)           |

## Writing an extension

A source is a separate package that implements one interface and runs inside an
isolated Web Worker. Start at
[docs/en/extensions/writing-an-extension.md](docs/en/extensions/writing-an-extension.md).

## Note

Mirai is an empty client. The extension repos you add, and compliance with the
terms of service of the sites they scrape, are your own responsibility.
