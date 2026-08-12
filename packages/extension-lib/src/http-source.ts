import type {
  AnimeSource,
  CatalogueSource,
  EntriesPage,
  FilterList,
  HttpClient,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
  MangaSource,
  PreferenceStore,
  SAnime,
  SChapter,
  SEntry,
  SEpisode,
  SManga,
  SPage,
  SourceContext,
  SVideo,
} from '@mirai/extension-api'
import { HttpError } from '@mirai/extension-api'
import { absoluteUrl, parseHtml, type MDocument } from './html.js'
import { DEFAULT_USER_AGENT } from './util.js'

/**
 * Basis untuk source berbasis scraping HTML. Padanan `ParsedHttpSource` di
 * Aniyomi: penulis extension cukup menyediakan pasangan `*Request` dan
 * `*Parse`, sisanya — header, fetch, parsing, penanganan error — sudah di sini.
 *
 * Source berbasis API JSON (mis. MangaDex) tidak wajib memakai kelas ini;
 * mengimplementasikan `MangaSource`/`AnimeSource` langsung juga sah.
 */
export abstract class ParsedHttpSource<T extends SEntry> implements CatalogueSource<T> {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly lang: string
  abstract readonly baseUrl: string

  readonly supportsLatest: boolean = true
  readonly isNsfw: boolean = false

  protected readonly http: HttpClient
  protected readonly prefs: PreferenceStore

  constructor(ctx: SourceContext) {
    this.http = ctx.http
    this.prefs = ctx.preferences
  }

  /**
   * Header bawaan tiap request. Banyak situs sumber menolak permintaan tanpa
   * Referer yang cocok, jadi ini nilai awal yang waras — bukan sekadar hiasan.
   */
  protected headers(): HttpHeaders {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: `${this.baseUrl}/`,
    }
  }

  /** Menyusun request GET dengan header bawaan. */
  protected get(path: string, headers?: HttpHeaders): HttpRequest {
    return {
      url: absoluteUrl(this.baseUrl, path),
      method: 'GET',
      headers: { ...this.headers(), ...headers },
    }
  }

  protected async fetchDocument(req: HttpRequest): Promise<{ doc: MDocument; res: HttpResponse }> {
    const res = await this.http.request(req)
    if (!res.ok) throw new HttpError(res.status, res.url)
    return { doc: parseHtml(res.body), res }
  }

  // --- Populer ---------------------------------------------------------------

  protected abstract popularRequest(page: number): HttpRequest
  protected abstract popularParse(doc: MDocument, res: HttpResponse): EntriesPage<T>

  async getPopular(page: number): Promise<EntriesPage<T>> {
    const { doc, res } = await this.fetchDocument(this.popularRequest(page))
    return this.popularParse(doc, res)
  }

  // --- Terbaru ---------------------------------------------------------------

  protected latestRequest(_page: number): HttpRequest {
    throw new Error(`${this.name} tidak menyediakan daftar terbaru`)
  }

  protected latestParse(doc: MDocument, res: HttpResponse): EntriesPage<T> {
    // Sebagian besar situs memakai markup yang sama untuk populer dan terbaru;
    // override hanya kalau memang berbeda.
    return this.popularParse(doc, res)
  }

  async getLatest(page: number): Promise<EntriesPage<T>> {
    const { doc, res } = await this.fetchDocument(this.latestRequest(page))
    return this.latestParse(doc, res)
  }

  // --- Pencarian -------------------------------------------------------------

  protected abstract searchRequest(page: number, query: string, filters: FilterList): HttpRequest
  protected abstract searchParse(doc: MDocument, res: HttpResponse): EntriesPage<T>

  async getSearch(page: number, query: string, filters: FilterList): Promise<EntriesPage<T>> {
    const { doc, res } = await this.fetchDocument(this.searchRequest(page, query, filters))
    return this.searchParse(doc, res)
  }

  // --- Detail ----------------------------------------------------------------

  protected detailsRequest(entry: T): HttpRequest {
    return this.get(entry.url)
  }

  protected abstract detailsParse(doc: MDocument, entry: T): T

  async getDetails(entry: T): Promise<T> {
    const { doc } = await this.fetchDocument(this.detailsRequest(entry))
    return this.detailsParse(doc, entry)
  }

  getFilterList(): FilterList {
    return []
  }
}

export abstract class ParsedMangaSource extends ParsedHttpSource<SManga> implements MangaSource {
  readonly kind = 'manga' as const

  protected chapterListRequest(manga: SManga): HttpRequest {
    return this.get(manga.url)
  }

  protected abstract chapterListParse(doc: MDocument, manga: SManga): SChapter[]

  async getChapterList(manga: SManga): Promise<SChapter[]> {
    const { doc } = await this.fetchDocument(this.chapterListRequest(manga))
    return this.chapterListParse(doc, manga)
  }

  protected pageListRequest(chapter: SChapter): HttpRequest {
    return this.get(chapter.url)
  }

  protected abstract pageListParse(doc: MDocument, res: HttpResponse): SPage[]

  async getPageList(chapter: SChapter): Promise<SPage[]> {
    const { doc, res } = await this.fetchDocument(this.pageListRequest(chapter))
    return this.pageListParse(doc, res)
  }
}

export abstract class ParsedAnimeSource extends ParsedHttpSource<SAnime> implements AnimeSource {
  readonly kind = 'anime' as const

  protected episodeListRequest(anime: SAnime): HttpRequest {
    return this.get(anime.url)
  }

  protected abstract episodeListParse(doc: MDocument, anime: SAnime): SEpisode[]

  async getEpisodeList(anime: SAnime): Promise<SEpisode[]> {
    const { doc } = await this.fetchDocument(this.episodeListRequest(anime))
    return this.episodeListParse(doc, anime)
  }

  protected videoListRequest(episode: SEpisode): HttpRequest {
    return this.get(episode.url)
  }

  /**
   * Halaman episode biasanya cuma memuat iframe; resolusi ke URL video asli
   * hampir selalu butuh request lanjutan, jadi ini sengaja async.
   */
  protected abstract videoListParse(doc: MDocument, res: HttpResponse): Promise<SVideo[]>

  async getVideoList(episode: SEpisode): Promise<SVideo[]> {
    const { doc, res } = await this.fetchDocument(this.videoListRequest(episode))
    return this.videoListParse(doc, res)
  }
}
