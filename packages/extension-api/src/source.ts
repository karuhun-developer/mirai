import type { FilterList } from './filters.js'
import type {
  EntriesPage,
  SAnime,
  SChapter,
  SEntry,
  SEpisode,
  SManga,
  SPage,
  SVideo,
} from './models.js'
import type { SourcePreference } from './preferences.js'

export interface Source {
  /** Stabil selamanya. Ganti id = entri lama di library kehilangan sumbernya. */
  readonly id: string
  readonly name: string
  /** BCP-47 pendek, atau `'all'` untuk source multi-bahasa. */
  readonly lang: string
  readonly baseUrl: string
  readonly supportsLatest: boolean
  readonly isNsfw: boolean
}

export interface CatalogueSource<T extends SEntry> extends Source {
  getPopular(page: number): Promise<EntriesPage<T>>
  getLatest(page: number): Promise<EntriesPage<T>>
  /**
   * `filters` adalah hasil `getFilterList()` yang `value`-nya sudah diisi user.
   * Filter yang tidak dikenali diabaikan diam-diam, bukan dilempar — user bisa
   * saja membawa filter tersimpan dari versi extension sebelumnya.
   */
  getSearch(page: number, query: string, filters: FilterList): Promise<EntriesPage<T>>
  /** Melengkapi entri hasil katalog; menerima dan mengembalikan bentuk yang sama. */
  getDetails(entry: T): Promise<T>
  getFilterList(): FilterList
}

export interface MangaSource extends CatalogueSource<SManga> {
  readonly kind: 'manga'
  /** Urutan bebas; host yang mengurutkan berdasarkan `chapterNumber`. */
  getChapterList(manga: SManga): Promise<SChapter[]>
  getPageList(chapter: SChapter): Promise<SPage[]>
}

export interface AnimeSource extends CatalogueSource<SAnime> {
  readonly kind: 'anime'
  getEpisodeList(anime: SAnime): Promise<SEpisode[]>
  /** Urutkan yang paling disukai di depan; host memakai indeks 0 sebagai default. */
  getVideoList(episode: SEpisode): Promise<SVideo[]>
}

export type AnySource = MangaSource | AnimeSource

/** Source yang punya setelan sendiri. Dideteksi host lewat `isConfigurable()`. */
export interface ConfigurableSource {
  getPreferences(): SourcePreference[]
}

export function isConfigurable(source: object): source is ConfigurableSource {
  return typeof (source as Partial<ConfigurableSource>).getPreferences === 'function'
}

export function isMangaSource(source: AnySource): source is MangaSource {
  return source.kind === 'manga'
}

export function isAnimeSource(source: AnySource): source is AnimeSource {
  return source.kind === 'anime'
}
