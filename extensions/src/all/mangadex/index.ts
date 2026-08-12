import type {
  ConfigurableSource,
  EntriesPage,
  FilterList,
  HttpClient,
  MangaSource,
  SChapter,
  SManga,
  SourceContext,
  SourceFactory,
  SourcePreference,
  SPage,
  SStatus,
} from '@mirai/extension-api'
import { HttpError } from '@mirai/extension-api'
import {
  arr,
  compact,
  get,
  isRecord,
  num,
  options,
  parseIsoDate,
  parseNumber,
  query,
  select,
  str,
  textFilter,
} from '@mirai/extension-lib'

/**
 * MangaDex — source pertama, sengaja dipilih karena API-nya resmi dan
 * terdokumentasi. Kalau kontrak `@mirai/extension-api` cukup untuk sumber
 * sekompleks ini, dia cukup untuk scraper HTML biasa.
 *
 * Referensi API: https://api.mangadex.org/docs/
 */

const API = 'https://api.mangadex.org'
const COVERS = 'https://uploads.mangadex.org/covers'
const PAGE_SIZE = 24

/** Bahasa terjemahan yang paling relevan untuk pengguna Mirai. */
const LANGUAGES = [
  { label: 'Indonesia', value: 'id' },
  { label: 'English', value: 'en' },
  { label: 'Japanese', value: 'ja' },
]

const CONTENT_RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic']

const SORTS = [
  { label: 'Paling diikuti', value: 'followedCount' },
  { label: 'Rating tertinggi', value: 'rating' },
  { label: 'Judul (A-Z)', value: 'title' },
  { label: 'Terakhir diunggah', value: 'latestUploadedChapter' },
]

const STATUS_MAP: Record<string, SStatus> = {
  ongoing: 'ongoing',
  completed: 'completed',
  hiatus: 'hiatus',
  cancelled: 'cancelled',
}

/**
 * Judul MangaDex berupa peta bahasa. Bahasa yang diminta didahulukan, lalu
 * Inggris, lalu apa pun yang ada — lebih baik judul berbahasa asing daripada
 * entri tanpa judul sama sekali.
 */
function pickLocalized(value: unknown, preferred: string): string {
  if (!isRecord(value)) return ''
  for (const key of [preferred, 'en', 'ja-ro', 'ja']) {
    const found = value[key]
    if (typeof found === 'string' && found) return found
  }
  const first = Object.values(value).find((item) => typeof item === 'string' && item)
  return typeof first === 'string' ? first : ''
}

function relationship(entity: unknown, type: string): Record<string, unknown> | undefined {
  return arr(get(entity, 'relationships')).find((rel) => isRecord(rel) && rel['type'] === type) as
    Record<string, unknown> | undefined
}

class MangaDexSource implements MangaSource, ConfigurableSource {
  readonly kind = 'manga' as const
  readonly id = 'mangadex'
  readonly name = 'MangaDex'
  readonly lang = 'all'
  readonly baseUrl = 'https://mangadex.org'
  readonly supportsLatest = true
  readonly isNsfw = false

  private readonly http: HttpClient
  private readonly language: string
  private readonly ratings: string[]
  private readonly dataSaver: boolean

  constructor(ctx: SourceContext) {
    this.http = ctx.http
    this.language = ctx.preferences.getString('lang', 'id')
    this.ratings = ctx.preferences.getStringList('contentRating', ['safe', 'suggestive'])
    this.dataSaver = ctx.preferences.getBoolean('dataSaver', false)
  }

  getPreferences(): SourcePreference[] {
    return [
      {
        type: 'list',
        key: 'lang',
        title: 'Bahasa terjemahan',
        summary: 'Menentukan judul dan daftar chapter yang ditampilkan',
        entries: LANGUAGES.map((item) => item.label),
        values: LANGUAGES.map((item) => item.value),
        default: 'id',
      },
      {
        type: 'multiselect',
        key: 'contentRating',
        title: 'Rating konten',
        entries: CONTENT_RATINGS,
        values: CONTENT_RATINGS,
        default: ['safe', 'suggestive'],
      },
      {
        type: 'switch',
        key: 'dataSaver',
        title: 'Hemat kuota',
        summary: 'Memakai gambar terkompresi; lebih cepat, sedikit lebih buram',
        default: false,
      },
    ]
  }

  getFilterList(): FilterList {
    return [
      textFilter('author', 'Nama author', 'Kosongkan kalau tidak dipakai'),
      select('order', 'Urutkan', SORTS),
      select('status', 'Status', [
        { label: 'Semua', value: '' },
        ...options('ongoing', 'completed', 'hiatus', 'cancelled'),
      ]),
    ]
  }

  // --- Katalog ---------------------------------------------------------------

  private listUrl(page: number, extra: string): string {
    const offset = (page - 1) * PAGE_SIZE
    const ratings = this.ratings.map((rating) => `&contentRating[]=${rating}`).join('')
    return `${API}/manga${query({ limit: PAGE_SIZE, offset })}&includes[]=cover_art${ratings}${extra}`
  }

  private async fetchList(url: string): Promise<EntriesPage<SManga>> {
    const payload = await this.http.getJson(url)
    if (str(get(payload, 'result')) === 'error') {
      throw new HttpError(
        400,
        url,
        str(get(payload, 'errors', 0, 'detail'), 'MangaDex menolak permintaan'),
      )
    }

    const data = arr(get(payload, 'data'))
    const total = num(get(payload, 'total')) ?? 0
    const offset = num(get(payload, 'offset')) ?? 0

    return {
      entries: data.map((entity) => this.toManga(entity)),
      hasNextPage: offset + data.length < total,
    }
  }

  getPopular(page: number): Promise<EntriesPage<SManga>> {
    return this.fetchList(
      this.listUrl(page, '&order[followedCount]=desc&hasAvailableChapters=true'),
    )
  }

  getLatest(page: number): Promise<EntriesPage<SManga>> {
    return this.fetchList(this.listUrl(page, '&order[latestUploadedChapter]=desc'))
  }

  getSearch(page: number, search: string, filters: FilterList): Promise<EntriesPage<SManga>> {
    let extra = search ? `&title=${encodeURIComponent(search)}` : ''

    for (const filter of filters) {
      if (filter.key === 'order' && filter.type === 'select') {
        const chosen = filter.options[filter.value]?.value
        // `title` satu-satunya yang wajar menaik; sisanya user mau yang teratas.
        if (chosen) extra += `&order[${chosen}]=${chosen === 'title' ? 'asc' : 'desc'}`
      }
      if (filter.key === 'status' && filter.type === 'select') {
        const chosen = filter.options[filter.value]?.value
        if (chosen) extra += `&status[]=${chosen}`
      }
      if (filter.key === 'author' && filter.type === 'text' && filter.value.trim()) {
        extra += `&authorOrArtist=${encodeURIComponent(filter.value.trim())}`
      }
    }

    return this.fetchList(this.listUrl(page, extra || '&order[followedCount]=desc'))
  }

  private toManga(entity: unknown): SManga {
    const id = str(get(entity, 'id'))
    const attributes = get(entity, 'attributes')
    const cover = str(get(relationship(entity, 'cover_art'), 'attributes', 'fileName'))

    return compact<SManga>({
      url: `/manga/${id}`,
      title: pickLocalized(get(attributes, 'title'), this.language) || id,
      // Ukuran .256.jpg cukup untuk grid dan jauh lebih hemat daripada asli.
      thumbnailUrl: cover ? `${COVERS}/${id}/${cover}.256.jpg` : undefined,
    })
  }

  // --- Detail ----------------------------------------------------------------

  async getDetails(manga: SManga): Promise<SManga> {
    const id = manga.url.split('/').pop() ?? ''
    const url = `${API}/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`
    const payload = await this.http.getJson(url)
    const entity = get(payload, 'data')
    const attributes = get(entity, 'attributes')

    const genre = arr(get(attributes, 'tags'))
      .map((tag) => pickLocalized(get(tag, 'attributes', 'name'), this.language))
      .filter(Boolean)

    return compact<SManga>({
      ...manga,
      ...this.toManga(entity),
      author: str(get(relationship(entity, 'author'), 'attributes', 'name')) || undefined,
      artist: str(get(relationship(entity, 'artist'), 'attributes', 'name')) || undefined,
      description: pickLocalized(get(attributes, 'description'), this.language) || undefined,
      genre: genre.length > 0 ? genre : undefined,
      status: STATUS_MAP[str(get(attributes, 'status'))] ?? 'unknown',
    })
  }

  // --- Chapter ---------------------------------------------------------------

  async getChapterList(manga: SManga): Promise<SChapter[]> {
    const id = manga.url.split('/').pop() ?? ''
    const ratings = this.ratings.map((rating) => `&contentRating[]=${rating}`).join('')
    const chapters: SChapter[] = []

    // Feed dibatasi 500 per permintaan; judul panjang bisa melewatinya, jadi
    // halamannya ditelusuri sampai habis alih-alih memotong daftar diam-diam.
    for (let offset = 0; ; offset += 500) {
      const url =
        `${API}/manga/${id}/feed${query({ limit: 500, offset })}` +
        `&translatedLanguage[]=${this.language}${ratings}` +
        '&includes[]=scanlation_group&order[volume]=desc&order[chapter]=desc'

      const payload = await this.http.getJson(url)
      const data = arr(get(payload, 'data'))
      for (const entity of data) chapters.push(this.toChapter(entity))

      const total = num(get(payload, 'total')) ?? 0
      if (data.length === 0 || offset + data.length >= total) break
    }

    return chapters
  }

  private toChapter(entity: unknown): SChapter {
    const id = str(get(entity, 'id'))
    const attributes = get(entity, 'attributes')
    const chapter = str(get(attributes, 'chapter'))
    const volume = str(get(attributes, 'volume'))
    const title = str(get(attributes, 'title'))

    const label = chapter ? `Chapter ${chapter}` : 'Oneshot'
    const prefix = volume ? `Vol. ${volume} ` : ''

    return compact<SChapter>({
      url: `/chapter/${id}`,
      name: title ? `${prefix}${label} — ${title}` : `${prefix}${label}`,
      chapterNumber: parseNumber(chapter),
      dateUpload: parseIsoDate(str(get(attributes, 'publishAt'))),
      scanlator:
        str(get(relationship(entity, 'scanlation_group'), 'attributes', 'name')) || undefined,
    })
  }

  // --- Halaman ---------------------------------------------------------------

  async getPageList(chapter: SChapter): Promise<SPage[]> {
    const id = chapter.url.split('/').pop() ?? ''
    const payload = await this.http.getJson(`${API}/at-home/server/${id}`)

    const baseUrl = str(get(payload, 'baseUrl'))
    const hash = str(get(payload, 'chapter', 'hash'))
    const folder = this.dataSaver ? 'data-saver' : 'data'
    const files = arr(get(payload, 'chapter', this.dataSaver ? 'dataSaver' : 'data')).filter(
      (file): file is string => typeof file === 'string',
    )

    if (!baseUrl || !hash || files.length === 0) {
      throw new Error('MangaDex tidak mengembalikan daftar halaman untuk chapter ini')
    }

    return files.map((file, index) => ({
      index,
      imageUrl: `${baseUrl}/${folder}/${hash}/${file}`,
    }))
  }
}

const factory: SourceFactory = (ctx) => [new MangaDexSource(ctx)]

export default factory
