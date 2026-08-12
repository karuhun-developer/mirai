import type {
  ConfigurableSource,
  EntriesPage,
  FilterList,
  HttpRequest,
  SChapter,
  SManga,
  SourceContext,
  SourceFactory,
  SourcePreference,
  SPage,
  SStatus,
} from '@mirai/extension-api'
import type { MDocument } from '@mirai/extension-lib'
import {
  attr,
  compact,
  imageSrc,
  labeledValue,
  options,
  parseIsoDate,
  ParsedMangaSource,
  parseHtml,
  refererHeaders,
  select,
  selectAll,
  selectedOption,
  text,
  textOf,
} from '@mirai/extension-lib'

/**
 * KunManga — WordPress dengan tema **Madara**, tema yang dipakai ratusan situs
 * pembaca manga, jadi selektor di bawah ini sebetulnya selektor Madara.
 *
 * ⚠️ **Belum terverifikasi terhadap situs aslinya.** Seluruh kunmanga.com —
 * termasuk `robots.txt` dan `/wp-json/` — berada di balik Cloudflare managed
 * challenge, jadi tidak ada satu pun respons yang bisa diperiksa waktu extension
 * ini ditulis. Selektornya disalin dari struktur Madara yang stabil bertahun-
 * tahun, tapi anggap ini tebakan terdidik sampai ada yang menjalankannya dengan
 * sesi yang sudah lolos verifikasi.
 *
 * Cloudflare-nya sendiri bukan urusan extension: host yang menyelesaikan
 * tantangan itu (di native, cookie-nya dipakai bersama WebView), persis seperti
 * Aniyomi. Kalau penggunanya tidak bisa menyelesaikan captcha, source ini
 * memang tidak akan jalan.
 */

const DEFAULT_BASE_URL = 'https://kunmanga.com'

const STATUS_MAP: Record<string, SStatus> = {
  ongoing: 'ongoing',
  completed: 'completed',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  'on hold': 'hiatus',
  'on-hold': 'hiatus',
}

/** Nilai `m_orderby` yang dikenal Madara. */
const ORDERS = [
  { label: 'Terpopuler', value: 'views' },
  { label: 'Terbaru diperbarui', value: 'latest' },
  { label: 'Rating', value: 'rating' },
  { label: 'Baru ditambahkan', value: 'new-manga' },
  { label: 'A-Z', value: 'alphabet' },
]

const GENRES = [
  'action',
  'adventure',
  'comedy',
  'drama',
  'fantasy',
  'harem',
  'historical',
  'horror',
  'isekai',
  'josei',
  'manhua',
  'manhwa',
  'martial-arts',
  'mature',
  'mystery',
  'psychological',
  'romance',
  'school-life',
  'sci-fi',
  'seinen',
  'shoujo',
  'shounen',
  'slice-of-life',
  'smut',
  'supernatural',
  'tragedy',
  'webtoon',
]

class KunMangaSource extends ParsedMangaSource implements ConfigurableSource {
  readonly id = 'kunmanga'
  readonly name = 'KunManga'
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
        default: DEFAULT_BASE_URL,
        placeholder: DEFAULT_BASE_URL,
      },
    ]
  }

  getFilterList(): FilterList {
    return [
      select('order', 'Urutkan', ORDERS),
      select('genre', 'Genre', [{ label: 'Semua', value: '' }, ...options(...GENRES)]),
    ]
  }

  // --- Katalog ---------------------------------------------------------------

  private listRequest(page: number, order: string, genre = ''): HttpRequest {
    const base = genre ? `/manga-genre/${genre}` : '/manga'
    // Madara memakai paginasi WordPress; halaman 1 tanpa segmen `/page/1/`
    // karena sebagian pemasangan mengalihkannya dan menghitungnya sebagai hit
    // yang berbeda.
    const path = page > 1 ? `${base}/page/${page}/` : `${base}/`
    return this.get(`${path}?m_orderby=${order}`)
  }

  protected popularRequest(page: number): HttpRequest {
    return this.listRequest(page, 'views')
  }

  protected override latestRequest(page: number): HttpRequest {
    return this.listRequest(page, 'latest')
  }

  protected searchRequest(page: number, query: string, filters: FilterList): HttpRequest {
    const term = query.trim()
    if (!term) {
      const order = selectedOption(filters, 'order')?.value ?? 'views'
      return this.listRequest(page, order, selectedOption(filters, 'genre')?.value ?? '')
    }

    const path = page > 1 ? `/page/${page}/` : '/'
    return this.get(`${path}?s=${encodeURIComponent(term)}&post_type=wp-manga`)
  }

  protected popularParse(doc: MDocument): EntriesPage<SManga> {
    const entries = selectAll(doc, 'div.page-item-detail').flatMap((item) => {
      const link = item.querySelector('h3 a, h5 a')
      const url = this.relative(attr(link, 'href'))
      if (!url) return []

      return [
        compact<SManga>({
          url,
          title: text(link),
          thumbnailUrl: imageSrc(item.querySelector('img'), 'data-lazy-srcset') || undefined,
        }),
      ]
    })

    // Madara merender tombol "Load more" hanya selama masih ada sisa, dan
    // halaman terakhir tidak punya tautan berikutnya sama sekali.
    const hasNextPage =
      doc.querySelector('div.nav-previous a, a.nextpostslink, div.wp-pagenavi a.nextpostslink') !==
      null

    return { entries, hasNextPage }
  }

  protected searchParse(doc: MDocument): EntriesPage<SManga> {
    return this.popularParse(doc)
  }

  // --- Detail ----------------------------------------------------------------

  protected detailsParse(doc: MDocument, manga: SManga): SManga {
    const info = 'div.post-content_item'
    const genre = selectAll(doc, 'div.genres-content a').map((link) => text(link))
    const author = selectAll(doc, 'div.author-content a').map((link) => text(link))
    const artist = selectAll(doc, 'div.artist-content a').map((link) => text(link))
    const status = labeledValue(doc, 'div.post-status div.post-content_item', 'Status')

    return compact<SManga>({
      ...manga,
      title: textOf(doc, 'div.post-title h1') || manga.title,
      thumbnailUrl: imageSrc(doc.querySelector('div.summary_image img')) || manga.thumbnailUrl,
      author: author.join(', ') || labeledValue(doc, info, 'Author') || undefined,
      artist: artist.join(', ') || undefined,
      description: textOf(doc, 'div.description-summary div.summary__content') || undefined,
      genre: genre.length > 0 ? genre : undefined,
      status: STATUS_MAP[status.toLowerCase()] ?? 'unknown',
    })
  }

  // --- Chapter ---------------------------------------------------------------

  /**
   * Madara memindahkan daftar chapter ke `POST <url-manga>ajax/chapters/`; yang
   * tersisa di halaman detail cuma pembungkus kosong. Kalau pemasangannya masih
   * versi lama, endpoint itu menjawab kosong dan halaman detailnya yang dipakai.
   */
  override async getChapterList(manga: SManga): Promise<SChapter[]> {
    const url = `${this.baseUrl}${manga.url.replace(/\/*$/, '/')}ajax/chapters/`

    try {
      const res = await this.http.post(url, '', {
        ...this.headers(),
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      })

      const chapters = this.chapterListParse(parseHtml(res.body))
      if (chapters.length > 0) return chapters
    } catch {
      // Jatuh ke halaman detail di bawah.
    }

    return super.getChapterList(manga)
  }

  protected chapterListParse(doc: MDocument): SChapter[] {
    return selectAll(doc, 'li.wp-manga-chapter').flatMap((item) => {
      const link = item.querySelector('a')
      const url = this.relative(attr(link, 'href'))
      if (!url) return []

      const name = text(link)
      return [
        compact<SChapter>({
          url,
          name,
          chapterNumber: chapterNumber(name),
          dateUpload: parseIsoDate(
            attr(item.querySelector('span.chapter-release-date i'), 'title'),
          ),
        }),
      ]
    })
  }

  // --- Halaman ---------------------------------------------------------------

  protected pageListParse(doc: MDocument): SPage[] {
    const headers = refererHeaders(this.baseUrl)

    const pages = selectAll(doc, 'div.reading-content img').flatMap((img, index) => {
      // Madara menunda pemuatan gambar: `src` cuma placeholder abu-abu, URL
      // aslinya ada di salah satu atribut data-*.
      const imageUrl = imageSrc(img)
      return imageUrl ? [{ index, imageUrl, headers }] : []
    })

    if (pages.length === 0) throw new Error('KunManga tidak memuat satu pun gambar chapter')
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

/** "Chapter 12.5 - Judul" → 12.5. Nama chapter Madara tidak punya kolom nomor. */
function chapterNumber(name: string): number | undefined {
  const match = /(?:chapter|ch\.?)\s*(\d+(?:\.\d+)?)/i.exec(name) ?? /(\d+(?:\.\d+)?)/.exec(name)
  const raw = match?.[1]
  if (raw === undefined) return undefined
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

const factory: SourceFactory = (ctx) => [new KunMangaSource(ctx)]

export default factory
