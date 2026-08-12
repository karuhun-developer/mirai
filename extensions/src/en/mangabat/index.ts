import type {
  ConfigurableSource,
  EntriesPage,
  FilterList,
  HttpRequest,
  HttpResponse,
  SChapter,
  SManga,
  SourceContext,
  SourceFactory,
  SourcePreference,
  SPage,
  SStatus,
} from '@mirai/extension-api'
import type { MDocument, MElement } from '@mirai/extension-lib'
import {
  arr,
  attr,
  compact,
  findWithText,
  firstMatch,
  get,
  imageSrc,
  labeledValue,
  num,
  options,
  parseIsoDate,
  ParsedMangaSource,
  refererHeaders,
  select,
  selectAll,
  selectedOption,
  str,
  text,
  textOf,
} from '@mirai/extension-lib'

/**
 * Mangabat — turunan tema Manganato, HTML biasa, kecuali daftar chapter yang
 * pindah ke endpoint JSON (`/api/manga/<slug>/chapters`) karena halaman detail
 * memuatnya belakangan lewat AJAX.
 */

const DEFAULT_BASE_URL = 'https://www.mangabats.com'

/** Batas per permintaan daftar chapter; server menerima sampai jauh di atas ini. */
const CHAPTER_PAGE_SIZE = 500

/** Judul dengan ribuan chapter tetap harus berhenti kalau `has_more` ngawur. */
const MAX_CHAPTER_PAGES = 20

const STATUS_MAP: Record<string, SStatus> = {
  ongoing: 'ongoing',
  completed: 'completed',
}

/**
 * Genre diambil dari halaman filter situs. Sengaja tidak dijaring waktu jalan:
 * daftarnya 235 entri yang sebagian besar salah ketik atau tag sekali pakai
 * ("acton", "3", "2019"), dan menampilkannya utuh justru bikin filter tak
 * terpakai.
 */
const GENRES = [
  'action',
  'adult',
  'adventure',
  'comedy',
  'cooking',
  'doujinshi',
  'drama',
  'ecchi',
  'fantasy',
  'gender-bender',
  'harem',
  'historical',
  'horror',
  'isekai',
  'josei',
  'manhua',
  'manhwa',
  'martial-arts',
  'mature',
  'mecha',
  'medical',
  'mystery',
  'one-shot',
  'psychological',
  'romance',
  'school-life',
  'sci-fi',
  'seinen',
  'shoujo',
  'shounen',
  'slice-of-life',
  'smut',
  'sports',
  'supernatural',
  'tragedy',
  'webtoons',
  'yaoi',
  'yuri',
]

class MangabatSource extends ParsedMangaSource implements ConfigurableSource {
  readonly id = 'mangabat'
  readonly name = 'Mangabat'
  readonly lang = 'en'
  override readonly supportsLatest = true

  readonly baseUrl: string

  constructor(ctx: SourceContext) {
    super(ctx)
    this.baseUrl = ctx.preferences.getString('baseUrl', DEFAULT_BASE_URL).replace(/\/+$/, '')
  }

  getPreferences(): SourcePreference[] {
    return [
      {
        type: 'text',
        key: 'baseUrl',
        title: 'Domain situs',
        summary: 'Mangabat punya banyak domain cermin; isi yang bisa dibuka dari jaringanmu',
        default: DEFAULT_BASE_URL,
        placeholder: DEFAULT_BASE_URL,
      },
    ]
  }

  /**
   * Hanya genre. Situs memang menerima `type=` dan `state=` di URL — breadcrumb-nya
   * bahkan memantulkannya kembali — tapi hasilnya sama persis untuk nilai apa
   * pun. Menawarkannya sebagai filter cuma menjanjikan sesuatu yang tidak ada.
   */
  getFilterList(): FilterList {
    return [select('genre', 'Genre', [{ label: 'Semua', value: '' }, ...options(...GENRES)])]
  }

  // --- Katalog ---------------------------------------------------------------

  protected popularRequest(page: number): HttpRequest {
    return this.get(`/manga-list/hot-manga?page=${page}`)
  }

  protected override latestRequest(page: number): HttpRequest {
    return this.get(`/manga-list/latest-manga?page=${page}`)
  }

  protected searchRequest(page: number, query: string, filters: FilterList): HttpRequest {
    const term = query.trim()
    if (!term) {
      const genre = selectedOption(filters, 'genre')?.value || 'all'
      return this.get(`/genre/${genre}?page=${page}`)
    }

    // Situs memakai slug, bukan query string: spasi dan tanda baca jadi garis
    // bawah. Mengirim kata kunci apa adanya menghasilkan 404, bukan nol hasil.
    const slug = term
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    return this.get(`/search/story/${encodeURIComponent(slug)}?page=${page}`)
  }

  protected popularParse(doc: MDocument, res: HttpResponse): EntriesPage<SManga> {
    const entries = selectAll(doc, 'div.list-comic-item-wrap').flatMap((item) => {
      const link = item.querySelector('a.list-story-item')
      const url = this.relative(attr(link, 'href'))
      // Blok iklan memakai markup kartu yang sama persis dengan `href="#"`;
      // hanya tujuannya yang membedakan.
      if (!url.startsWith('/manga/')) return []

      return [
        compact<SManga>({
          url,
          title: attr(link, 'title') || textOf(item, 'h3 a'),
          thumbnailUrl: imageSrc(item.querySelector('img')) || undefined,
        }),
      ]
    })

    return { entries, hasNextPage: hasNextPage(doc, pageOf(res.url)) }
  }

  /** Hasil pencarian memakai tata letak baris, bukan kartu. */
  protected searchParse(doc: MDocument, res: HttpResponse): EntriesPage<SManga> {
    const rows = selectAll(doc, 'div.panel_story_list div.story_item')
    if (rows.length === 0 && selectAll(doc, 'div.list-comic-item-wrap').length > 0) {
      // Pencarian kosong dialihkan ke halaman genre, yang memakai markup kartu.
      return this.popularParse(doc, res)
    }

    const entries = rows.flatMap((row) => this.toSearchEntry(row))
    return { entries, hasNextPage: hasNextPage(doc, pageOf(res.url)) }
  }

  private toSearchEntry(row: MElement): SManga[] {
    const link = row.querySelector('h3.story_name a')
    const url = this.relative(attr(link, 'href'))
    if (!url.startsWith('/manga/')) return []

    return [
      compact<SManga>({
        url,
        title: text(link),
        thumbnailUrl: imageSrc(row.querySelector('img')) || undefined,
      }),
    ]
  }

  // --- Detail ----------------------------------------------------------------

  protected detailsParse(doc: MDocument, manga: SManga): SManga {
    const info = 'ul.manga-info-text li'
    const genre = selectAll(doc, 'li.genres a').map((link) => text(link))

    return compact<SManga>({
      ...manga,
      title: textOf(doc, 'ul.manga-info-text h1') || manga.title,
      thumbnailUrl: imageSrc(doc.querySelector('div.manga-info-pic img')) || manga.thumbnailUrl,
      author: labeledValue(doc, info, 'Author') || undefined,
      description: description(doc) || undefined,
      genre: genre.length > 0 ? genre : undefined,
      status: STATUS_MAP[labeledValue(doc, info, 'Status').toLowerCase()] ?? 'unknown',
    })
  }

  // --- Chapter ---------------------------------------------------------------

  /**
   * Endpoint chapter memenggal hasilnya 50 per permintaan kalau `limit` tidak
   * dikirim — judul panjang jadi terpotong diam-diam. Karena itu dimintanya
   * bertahap sampai `has_more` habis, bukan sekali ambil.
   */
  override async getChapterList(manga: SManga): Promise<SChapter[]> {
    const slug = slugOf(manga.url)
    const chapters: SChapter[] = []

    for (let index = 0; index < MAX_CHAPTER_PAGES; index += 1) {
      const offset = index * CHAPTER_PAGE_SIZE
      const payload = await this.http.getJson(
        `${this.baseUrl}/api/manga/${slug}/chapters?limit=${CHAPTER_PAGE_SIZE}&offset=${offset}`,
        { ...this.headers(), 'X-Requested-With': 'XMLHttpRequest' },
      )

      for (const entity of arr(get(payload, 'data', 'chapters'))) {
        const chapterSlug = str(get(entity, 'chapter_slug'))
        if (!chapterSlug) continue

        chapters.push(
          compact<SChapter>({
            url: `/manga/${slug}/${chapterSlug}`,
            name: str(get(entity, 'chapter_name'), chapterSlug),
            chapterNumber: num(get(entity, 'chapter_num')),
            dateUpload: parseIsoDate(str(get(entity, 'updated_at'))),
          }),
        )
      }

      if (get(payload, 'data', 'pagination', 'has_more') !== true) break
    }

    return chapters
  }

  protected chapterListParse(): SChapter[] {
    throw new Error('tidak dipakai: daftar chapter Mangabat diambil lewat API JSON')
  }

  // --- Halaman ---------------------------------------------------------------

  protected pageListParse(doc: MDocument): SPage[] {
    // CDN gambarnya menjawab 403 tanpa Referer dari situs — bukan hotlink
    // protection yang bisa diabaikan, halamannya benar-benar tidak muncul.
    const headers = refererHeaders(this.baseUrl)

    const pages = selectAll(doc, 'div.container-chapter-reader img').flatMap((img, index) => {
      const imageUrl = imageSrc(img)
      return imageUrl ? [{ index, imageUrl, headers }] : []
    })

    if (pages.length === 0) throw new Error('Mangabat tidak memuat satu pun gambar chapter')
    return pages
  }

  /** URL disimpan relatif supaya entri di library selamat dari pergantian domain. */
  private relative(href: string): string {
    if (!href) return ''
    try {
      const parsed = new URL(href, this.baseUrl)
      return parsed.pathname + parsed.search
    } catch {
      return href
    }
  }
}

function slugOf(url: string): string {
  return url.split('/')[2] ?? ''
}

function pageOf(url: string): number {
  return num(firstMatch(/[?&]page=(\d+)/, url)) ?? 1
}

/**
 * Dua bentuk paginasi hidup berdampingan: daftar katalog memakai nomor halaman
 * plus tautan "Last(N)", sedangkan hasil pencarian cuma punya Previous/Next.
 */
function hasNextPage(doc: MDocument, page: number): boolean {
  const last = num(firstMatch(/[?&]page=(\d+)/, attr(doc.querySelector('a.page_last'), 'href')))
  if (last !== undefined) return page < last
  return findWithText(doc, 'div.group_page a[href]', 'Next') !== undefined
}

/** Sinopsis dibungkus judul "<Judul> summary:" yang bukan bagian dari isinya. */
function description(doc: MDocument): string {
  const raw = textOf(doc, '#contentBox')
  const marker = raw.toLowerCase().indexOf('summary:')
  return marker === -1 ? raw : raw.slice(marker + 'summary:'.length).trim()
}

const factory: SourceFactory = (ctx) => [new MangabatSource(ctx)]

export default factory
