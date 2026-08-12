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
import {
  arr,
  compact,
  get,
  num,
  options,
  parseIsoDate,
  query,
  refererHeaders,
  select,
  selectedOption,
  str,
} from '@mirai/extension-lib'

/**
 * Komikcast.
 *
 * Situs depannya SPA React di balik Cloudflare, jadi men-scrape HTML-nya
 * percuma — halamannya cuma kerangka kosong. Datanya diambil dari backend JSON
 * yang sama dengan yang dipakai SPA itu, yang menjawab langsung tanpa
 * tantangan Cloudflare.
 *
 * Dua host itulah sebabnya `baseUrl` (situs, dipakai sebagai Referer) berbeda
 * dari `apiUrl` (backend). Keduanya bisa diubah lewat preferensi: domain situs
 * bajakan berganti beberapa kali setahun, dan tanpa ini satu-satunya obat
 * adalah menunggu extension baru dirilis.
 */

const DEFAULT_BASE_URL = 'https://v3.komikcast.fit'
const DEFAULT_API_URL = 'https://be.komikcast.cc'

/** Jumlah entri per halaman yang dipakai backend kalau `take` tidak dikirim. */
const PAGE_SIZE = 24

const STATUS_MAP: Record<string, SStatus> = {
  ongoing: 'ongoing',
  completed: 'completed',
  hiatus: 'hiatus',
  dropped: 'cancelled',
}

const FORMATS = ['manga', 'manhwa', 'manhua']

/**
 * Backend menolak parameter yang tidak dikenalnya dengan mengembalikan nol
 * hasil — bukan error. Jadi daftar ini bukan hiasan: menambah kunci yang salah
 * ketik ke sini berarti katalog kosong tanpa satu pun pesan kegagalan.
 */
type ListParams = {
  page: number
  title?: string
  status?: string
  format?: string
}

class KomikcastSource implements MangaSource, ConfigurableSource {
  readonly kind = 'manga' as const
  readonly id = 'komikcast'
  readonly name = 'Komikcast'
  readonly lang = 'id'
  readonly supportsLatest = true
  readonly isNsfw = false

  readonly baseUrl: string
  private readonly apiUrl: string
  private readonly http: HttpClient

  constructor(ctx: SourceContext) {
    this.http = ctx.http
    this.baseUrl = trimSlash(ctx.preferences.getString('baseUrl', DEFAULT_BASE_URL))
    this.apiUrl = trimSlash(ctx.preferences.getString('apiUrl', DEFAULT_API_URL))
  }

  getPreferences(): SourcePreference[] {
    return [
      {
        type: 'text',
        key: 'baseUrl',
        title: 'Domain situs',
        summary: 'Dipakai sebagai Referer saat mengambil gambar chapter',
        default: DEFAULT_BASE_URL,
        placeholder: DEFAULT_BASE_URL,
      },
      {
        type: 'text',
        key: 'apiUrl',
        title: 'Domain API',
        summary: 'Sumber seluruh data. Ubah kalau katalog tiba-tiba kosong.',
        default: DEFAULT_API_URL,
        placeholder: DEFAULT_API_URL,
      },
    ]
  }

  getFilterList(): FilterList {
    return [
      select('status', 'Status', [
        { label: 'Semua', value: '' },
        { label: 'Ongoing', value: 'ongoing' },
        { label: 'Tamat', value: 'completed' },
      ]),
      select('format', 'Format', [{ label: 'Semua', value: '' }, ...options(...FORMATS)]),
    ]
  }

  // --- Katalog ---------------------------------------------------------------

  private async fetchList(path: string, params: ListParams): Promise<EntriesPage<SManga>> {
    const payload = await this.http.getJson(`${this.apiUrl}${path}${query({ ...params })}`)
    const data = arr(get(payload, 'data'))
    const page = num(get(payload, 'meta', 'page')) ?? params.page
    const lastPage = num(get(payload, 'meta', 'lastPage'))

    return {
      entries: data.map((entity) => toManga(entity)),
      // `/series/trending` memberi `lastPage`, endpoint lain kadang tidak.
      // Kalau tidak ada, halaman yang penuh dianggap masih ada lanjutannya.
      hasNextPage: lastPage === undefined ? data.length >= PAGE_SIZE : page < lastPage,
    }
  }

  /** Trending bulan ini — padanan terdekat "populer" yang disediakan backend. */
  getPopular(page: number): Promise<EntriesPage<SManga>> {
    return this.fetchList('/series/trending', { page })
  }

  getLatest(page: number): Promise<EntriesPage<SManga>> {
    return this.fetchList('/series', { page })
  }

  getSearch(page: number, search: string, filters: FilterList): Promise<EntriesPage<SManga>> {
    return this.fetchList('/series', {
      page,
      ...compact({
        title: search.trim() || undefined,
        status: selectedOption(filters, 'status')?.value || undefined,
        format: selectedOption(filters, 'format')?.value || undefined,
      }),
    })
  }

  // --- Detail ----------------------------------------------------------------

  async getDetails(manga: SManga): Promise<SManga> {
    const payload = await this.http.getJson(`${this.apiUrl}/series/${slugOf(manga.url)}`)
    const entity = get(payload, 'data')
    const data = get(entity, 'data')

    const genre = arr(get(data, 'genres'))
      .map((item) => str(get(item, 'data', 'name')))
      .filter(Boolean)

    return compact<SManga>({
      ...manga,
      ...toManga(entity),
      author: str(get(data, 'author')) || undefined,
      description: str(get(data, 'synopsis')) || undefined,
      genre: genre.length > 0 ? genre : undefined,
      status: STATUS_MAP[str(get(data, 'status')).toLowerCase()] ?? 'unknown',
    })
  }

  // --- Chapter ---------------------------------------------------------------

  async getChapterList(manga: SManga): Promise<SChapter[]> {
    const slug = slugOf(manga.url)
    const payload = await this.http.getJson(`${this.apiUrl}/series/${slug}/chapters`)

    return arr(get(payload, 'data')).flatMap((entity) => {
      const index = num(get(entity, 'data', 'index'))
      // Nomor chapter adalah satu-satunya cara memanggil halamannya; entri tanpa
      // nomor tidak bisa dibuka sama sekali, jadi dibuang di sini alih-alih
      // muncul di daftar dan gagal waktu diketuk.
      if (index === undefined) return []

      const title = str(get(entity, 'data', 'title'))
      return [
        compact<SChapter>({
          url: `/series/${slug}/chapters/${index}`,
          name: title ? `Chapter ${index} — ${title}` : `Chapter ${index}`,
          chapterNumber: index,
          dateUpload: parseIsoDate(str(get(entity, 'createdAt'))),
        }),
      ]
    })
  }

  // --- Halaman ---------------------------------------------------------------

  async getPageList(chapter: SChapter): Promise<SPage[]> {
    const payload = await this.http.getJson(`${this.apiUrl}${chapter.url}`)
    const images = arr(get(payload, 'data', 'data', 'images')).filter(
      (image): image is string => typeof image === 'string',
    )

    if (images.length === 0) {
      throw new Error(`Komikcast tidak mengembalikan halaman untuk ${chapter.name}`)
    }

    // CDN gambarnya menolak permintaan tanpa Referer dari situs depan.
    const headers = refererHeaders(this.baseUrl)
    return images.map((imageUrl, index) => ({ index, imageUrl, headers }))
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/** `/series/<slug>` maupun `/series/<slug>/chapters/<n>` sama-sama memberi slug. */
function slugOf(url: string): string {
  return url.split('/')[2] ?? ''
}

/**
 * Cover adalah URL presigned MinIO yang kedaluwarsa dalam 24 jam. Jadi
 * thumbnail yang tersimpan di library akan mati sendiri dan harus diambil ulang
 * lewat `getDetails` — bukan bug, memang begitu bentuk sumbernya.
 */
function toManga(entity: unknown): SManga {
  const data = get(entity, 'data')
  const slug = str(get(data, 'slug'))

  return compact<SManga>({
    url: `/series/${slug}`,
    title: str(get(data, 'title')) || slug,
    thumbnailUrl: str(get(data, 'coverImage')) || undefined,
  })
}

const factory: SourceFactory = (ctx) => [new KomikcastSource(ctx)]

export default factory
