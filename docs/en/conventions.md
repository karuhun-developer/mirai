# Conventions

> English version of [../conventions.md](../conventions.md). Indonesian is the
> source of truth — when the two disagree, the Indonesian one is right.

These rules apply to every phase. If one gets in the way, change this document
first — do not make a quiet exception.

## Language

- Code comments and user-visible strings: **Indonesian**.
- Identifiers (variables, functions, types, tables): **English**.
- Comments explain **why**, not **what**. If a line guards a trap, the trap is
  written down right there.

Contributors writing extensions do not need Indonesian: the extension contract,
its types, and the guides in [extensions/](extensions/) are English.

## TypeScript

- `strict` on, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- `any` is banned (`@typescript-eslint/no-explicit-any: error`). Data entering
  the app comes from third-party extension code; that type boundary has to hold
  at compile time. When a shape is not known yet, use `unknown` and narrow.
- Type imports use `import type` / inline `type`.
- TypeScript is pinned to `~6.0.x` (tilde, not caret). `typescript-eslint` 8.x
  only accepts `<6.1.0`; a caret would raise it silently and break lint.

## Layers

`UI → store → service → repository → Db`. Skipping a layer is not allowed:

- components do not call repositories;
- stores do not write SQL;
- services are the only place a cross-table transaction is opened.

## File naming

| Kind       | Pattern                                    | Example                                |
| ---------- | ------------------------------------------ | -------------------------------------- |
| Page       | `PascalCasePage.vue` in `pages/<feature>/` | `pages/library/LibraryPage.vue`        |
| Component  | `PascalCase.vue`                           | `components/layout/SideRail.vue`       |
| Repository | `camelCase.repo.ts`                        | `repositories/entry.repo.ts`           |
| Service    | `camelCase.service.ts`                     | `services/download.service.ts`         |
| Store      | lowercase noun                             | `stores/library.ts`                    |
| Extension  | `extensions/src/<lang>/<slug>/index.ts`    | `extensions/src/id/komikcast/index.ts` |

Routes are named, and navigation targets the name rather than the path, so URLs
can change without touching navigation.

## UI components

- shadcn-vue is vendored by hand, not through the CLI. One folder per component:
  `index.ts` holds `cva()` + re-exports, `Component.vue` wraps a reka-ui
  `Primitive` and merges classes through `cn()`.
- Colours **always** go through semantic tokens (`bg-primary`,
  `text-muted-foreground`, `bg-unread`). No hex values or raw Tailwind colours in
  components.
- The navigation list has a single source: `components/layout/navItems.ts`.

## Extensions

- `extension-api` may never have a runtime dependency. Ever.
- A breaking change to the contract bumps `apiVersion`; the runtime rejects
  mismatched extensions with a message naming both versions.
- Extensions never call the global `fetch` directly — always the injected
  `HttpClient`, so rate limiting and cookies stay on the host.

## Tests

- `vitest` for unit and contract tests.
- `scripts/smoke.mjs` (Playwright) for end-to-end flows in a real browser, at
  375px and 1440px at minimum.
- Every phase closes with `pnpm build`, `pnpm typecheck`, `pnpm lint`,
  `pnpm format:check`, and a green smoke run. The result is written into the
  CHANGELOG.

## Documentation

- Feature documents are written **alongside** the feature, not afterwards.
- Template for `docs/features/<feature>.md` (written in Indonesian):

  ```
  # Fitur: <Name>
  **Status:** <status> · **Route:** `/x`
  ## Tujuan        ← goal
  ## User Flow
  ## Data & Aturan ← data & rules
  ## Kode          ← file paths + what each one does
  ```

- The CHANGELOG follows Keep a Changelog + SemVer, one phase per minor release,
  with entries linking to feature documents to stay short.
- English copies live under `docs/en/` and are translations, never the original.
  A change to behaviour edits the Indonesian document first.

## Commits

Conventional Commits with a scope, Indonesian subject, lowercase, no trailing
period:

```
feat(reader): mode webtoon continuous
fix(proxy): teruskan Range apa adanya biar seek video tidak mengulang dari awal
docs(extensions): panduan menulis source manga
chore(deps): pin typescript ke 6.0.x
```

Commits are kept **small and focused** along natural seams (schema → service →
UI → docs) rather than one fat commit per phase. The body explains the root cause
or lists what changed. Trailer:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
