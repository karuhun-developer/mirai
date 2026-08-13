# Dokumentasi Mirai

Klien manga & anime berbasis extension. Web-first, offline-first, bisa dibungkus
jadi APK.

## Peta dokumen

| Dokumen                            | Isi                                                        |
| ---------------------------------- | ---------------------------------------------------------- |
| [PRD.md](PRD.md)                   | Masalah, tujuan, persona, scope, non-goals                 |
| [DESIGN.md](DESIGN.md)             | Token warna, tipografi, breakpoint, pola komponen          |
| [architecture.md](architecture.md) | Lapisan, alur data, jaringan, penyimpanan                  |
| [conventions.md](conventions.md)   | Aturan koding yang wajib diikuti di semua fase             |
| [roadmap.md](roadmap.md)           | Fase 0–9, status, kriteria selesai                         |
| [extensions/](extensions/)         | Cara menulis extension + API reference                     |
| [features/](features/)             | Satu dokumen per fitur — ditulis bersamaan dengan fiturnya |
| [en/](en/)                         | Terjemahan Inggris untuk penulis extension                 |

## Dokumen fitur

| Fitur                        | Fase | Dokumen                                                        |
| ---------------------------- | ---- | -------------------------------------------------------------- |
| Shell layout & navigasi      | 0    | [features/app-shell.md](features/app-shell.md)                 |
| Runtime extension & Browse   | 1    | [features/extension-runtime.md](features/extension-runtime.md) |
| Proxy jaringan               | 1    | [features/network-proxy.md](features/network-proxy.md)         |
| Manajemen extension & repo   | 2    | [features/extension-manager.md](features/extension-manager.md) |
| Tantangan Cloudflare         | 2    | [features/cloudflare.md](features/cloudflare.md)               |
| Library, kategori, Updates   | 3    | [features/library.md](features/library.md)                     |
| Reader manga                 | 4    | [features/reader.md](features/reader.md)                       |
| Player anime                 | 5    | [features/player.md](features/player.md)                       |
| Unduhan manga & anime        | 6–7  | [features/downloads.md](features/downloads.md)                 |
| Build Android                | 8    | [features/android.md](features/android.md)                     |
| Backup & restore             | 9    | [features/backup.md](features/backup.md)                       |
| Mode incognito               | 9    | [features/privasi.md](features/privasi.md)                     |
| Bahasa antarmuka (i18n)      | 9    | [features/i18n.md](features/i18n.md)                           |
| Migrasi antar-source         | 9    | [features/migrasi.md](features/migrasi.md)                     |
| Performa daftar besar & a11y | 9    | [features/performa-a11y.md](features/performa-a11y.md)         |
| Tracker MAL/AniList          | 9    | [features/tracker.md](features/tracker.md) — sengaja ditunda   |

## Menulis extension

| Dokumen                                                                  | Isi                                      |
| ------------------------------------------------------------------------ | ---------------------------------------- |
| [extensions/writing-an-extension.md](extensions/writing-an-extension.md) | Panduan langkah demi langkah + checklist |
| [extensions/api-reference.md](extensions/api-reference.md)               | Referensi tipe dan helper lengkap        |

## Mulai dari mana

```bash
pnpm install
cp apps/proxy/.env.example apps/proxy/.env

pnpm --filter @mirai/extensions build   # bangun extension → extensions/dist
pnpm dev                                # http://localhost:5180
pnpm dev:proxy                          # http://127.0.0.1:5181 (wajib untuk build web)
```
