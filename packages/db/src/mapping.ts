import type { SAnime, SChapter, SEntry, SEpisode, SManga } from '@mirai/extension-api'
import type { EntryKind, EntryRow, ItemRow } from './types.js'
import { entryId, itemId, nowMs, toFlag } from './util.js'

/**
 * Terjemahan antara bentuk yang dikembalikan extension (`S*`) dan baris tabel.
 *
 * Dikumpulkan di satu berkas dengan sengaja: extension boleh mengembalikan
 * bidang opsional yang kosong, dan setiap tempat yang menerjemahkan sendiri
 * cepat atau lambat akan menulis `undefined` ke kolom NOT NULL. Di sini
 * `undefined` selalu jadi `null`, sekali.
 */

function orNull<T>(value: T | undefined): T | null {
  return value ?? null
}

/** Genre disimpan sebagai JSON: tidak pernah di-query, cuma ditampilkan. */
function encodeGenre(genre: string[] | undefined): string | null {
  return genre && genre.length > 0 ? JSON.stringify(genre) : null
}

export function decodeGenre(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

/**
 * Entri hasil katalog. Yang datang dari Populer/Terbaru/Cari cuma punya judul
 * dan cover, jadi kolom detail sengaja dibiarkan kosong — dan `saveCatalogue()`
 * memang tidak akan menimpanya kalau detailnya sudah pernah diambil.
 */
export function toEntryRow(kind: EntryKind, sourceId: string, entry: SEntry): EntryRow {
  const manga = entry as SManga
  const anime = entry as SAnime
  const now = nowMs()

  return {
    id: entryId(sourceId, entry.url),
    kind,
    source_id: sourceId,
    url: entry.url,
    title: entry.title,
    thumbnail_url: orNull(entry.thumbnailUrl),
    author: orNull(manga.author),
    artist: orNull(manga.artist),
    description: orNull(manga.description ?? anime.description),
    genre: encodeGenre(manga.genre ?? anime.genre),
    status: orNull(manga.status ?? anime.status),
    studio: orNull(anime.studio),
    total_episodes: orNull(anime.totalEpisodes),
    favorite: 0,
    added_at: null,
    details_at: null,
    items_at: null,
    updated_at: now,
  }
}

/** Kebalikannya: baris DB dipakai lagi sebagai argumen ke extension. */
export function toSEntry(row: EntryRow): SManga & SAnime {
  const entry = {
    url: row.url,
    title: row.title,
  } as SManga & SAnime

  if (row.thumbnail_url !== null) entry.thumbnailUrl = row.thumbnail_url
  if (row.author !== null) entry.author = row.author
  if (row.artist !== null) entry.artist = row.artist
  if (row.description !== null) entry.description = row.description
  if (row.studio !== null) entry.studio = row.studio
  if (row.total_episodes !== null) entry.totalEpisodes = row.total_episodes
  const genre = decodeGenre(row.genre)
  if (genre.length > 0) entry.genre = genre

  return entry
}

export function toItemRow(entry: EntryRow, source: SChapter | SEpisode, index: number): ItemRow {
  const chapter = source as SChapter
  const episode = source as SEpisode
  const now = nowMs()

  return {
    id: itemId(entry.id, source.url),
    entry_id: entry.id,
    url: source.url,
    name: source.name,
    number: orNull(chapter.chapterNumber ?? episode.episodeNumber),
    date_upload: orNull(source.dateUpload),
    scanlator: orNull(chapter.scanlator),
    filler: toFlag(episode.filler === true),
    seen: 0,
    last_position: 0,
    total_position: null,
    bookmark: 0,
    downloaded: 0,
    sort_index: index,
    added_at: now,
    updated_at: now,
  }
}

/** Baris item dipakai kembali sebagai `SChapter`/`SEpisode` saat membuka reader. */
export function toSItem(row: ItemRow): SChapter & SEpisode {
  const item = { url: row.url, name: row.name } as SChapter & SEpisode
  if (row.number !== null) {
    item.chapterNumber = row.number
    item.episodeNumber = row.number
  }
  if (row.date_upload !== null) item.dateUpload = row.date_upload
  if (row.scanlator !== null) item.scanlator = row.scanlator
  if (row.filler === 1) item.filler = true
  return item
}
