# Mirai Documentation (English)

> English version of [../README.md](../README.md). Indonesian is the source of
> truth — when the two disagree, the Indonesian one is right.

An extension-based manga and anime client. Web-first, offline-first, and
packageable as an APK.

## Translated documents

Only the documents an extension author needs are translated. Everything else is
Indonesian, because that is where behaviour is decided first.

| Document                                                                 | Contents                               |
| ------------------------------------------------------------------------ | -------------------------------------- |
| [../../README_EN.md](../../README_EN.md)                                 | Project overview, commands, roadmap    |
| [architecture.md](architecture.md)                                       | Layers, data flow, networking, storage |
| [conventions.md](conventions.md)                                         | Coding rules every change follows      |
| [extensions/writing-an-extension.md](extensions/writing-an-extension.md) | Step-by-step guide + checklist         |
| [extensions/api-reference.md](extensions/api-reference.md)               | Full type and helper reference         |

## Indonesian-only documents

| Document                       | Contents                                           |
| ------------------------------ | -------------------------------------------------- |
| [../PRD.md](../PRD.md)         | Problem, goals, personas, scope, non-goals         |
| [../DESIGN.md](../DESIGN.md)   | Colour tokens, typography, breakpoints, patterns   |
| [../roadmap.md](../roadmap.md) | Phases 0–9, status, completion criteria            |
| [../features/](../features/)   | One document per feature, written with the feature |

### Feature documents

| Feature                       | Phase | Document                                                                 |
| ----------------------------- | ----- | ------------------------------------------------------------------------ |
| Layout shell & navigation     | 0     | [../features/app-shell.md](../features/app-shell.md)                     |
| Extension runtime & Browse    | 1     | [../features/extension-runtime.md](../features/extension-runtime.md)     |
| Network proxy                 | 1     | [../features/network-proxy.md](../features/network-proxy.md)             |
| Extension & repo management   | 2     | [../features/extension-manager.md](../features/extension-manager.md)     |
| Cloudflare challenges         | 2     | [../features/cloudflare.md](../features/cloudflare.md)                   |
| Library, categories, Updates  | 3     | [../features/library.md](../features/library.md)                         |
| Manga reader                  | 4     | [../features/reader.md](../features/reader.md)                           |
| Anime player                  | 5     | [../features/player.md](../features/player.md)                           |
| Manga & anime downloads       | 6–7   | [../features/downloads.md](../features/downloads.md)                     |
| Android build                 | 8     | [../features/android.md](../features/android.md)                         |
| Backup & restore              | 9     | [../features/backup.md](../features/backup.md)                           |
| Incognito mode                | 9     | [../features/privasi.md](../features/privasi.md)                         |
| Interface language (i18n)     | 9     | [../features/i18n.md](../features/i18n.md)                               |
| Cross-source migration        | 9     | [../features/migrasi.md](../features/migrasi.md)                         |
| Large-list performance & a11y | 9     | [../features/performa-a11y.md](../features/performa-a11y.md)             |
| MAL/AniList tracker           | 9     | [../features/tracker.md](../features/tracker.md) — deliberately deferred |

## Where to start

```bash
pnpm install
cp apps/proxy/.env.example apps/proxy/.env

pnpm --filter @mirai/extensions build   # build extensions → extensions/dist
pnpm dev                                # http://localhost:5180
pnpm dev:proxy                          # http://127.0.0.1:5181 (required for web builds)
```
