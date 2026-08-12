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

## Dokumen fitur

| Fitur                      | Fase | Dokumen                                                        |
| -------------------------- | ---- | -------------------------------------------------------------- |
| Shell layout & navigasi    | 0    | [features/app-shell.md](features/app-shell.md)                 |
| Runtime extension & Browse | 1    | [features/extension-runtime.md](features/extension-runtime.md) |
| Proxy jaringan             | 1    | [features/network-proxy.md](features/network-proxy.md)         |

Fitur fase berikutnya (library, reader, player, unduhan) mendapat dokumennya
masing-masing saat dikerjakan.

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
