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

| Fitur                   | Fase | Dokumen                                        |
| ----------------------- | ---- | ---------------------------------------------- |
| Shell layout & navigasi | 0    | [features/app-shell.md](features/app-shell.md) |

Fitur fase berikutnya (extension runtime, library, reader, player, unduhan)
mendapat dokumennya masing-masing saat dikerjakan.

## Mulai dari mana

```bash
pnpm install
pnpm dev     # http://localhost:5180
```
