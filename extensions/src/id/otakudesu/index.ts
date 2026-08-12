import type {
  ConfigurableSource,
  EntriesPage,
  HttpRequest,
  HttpResponse,
  SAnime,
  SEpisode,
  SourceContext,
  SourceFactory,
  SourcePreference,
  SStatus,
  SVideo,
} from '@mirai/extension-api'
import type { MDocument, MElement } from '@mirai/extension-lib'
import {
  absoluteUrl,
  attr,
  attrOf,
  compact,
  decodeBase64,
  findWithText,
  firstMatch,
  get,
  imageSrc,
  labeledValue,
  mapLimit,
  num,
  parseHtml,
  ParsedAnimeSource,
  selectAll,
  str,
  text,
  textOf,
} from '@mirai/extension-lib'

/**
 * Otakudesu — anime sub Indo, scraper HTML biasa.
 *
 * Bagian yang tidak biasa cuma pengambilan video: tautan mirror di halaman
 * episode tidak berisi URL, melainkan payload base64 yang harus ditukar ke
 * `admin-ajax.php` dengan nonce sekali pakai. Alurnya dijelaskan di
 * `videoListParse()`.
 */

const DEFAULT_BASE_URL = 'https://otakudesu.blog'

const STATUS_MAP: Record<string, SStatus> = {
  ongoing: 'ongoing',
  completed: 'completed',
  tamat: 'completed',
  hiatus: 'hiatus',
}

const MONTHS: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
}

/** Host yang halaman embed-nya masih menaruh URL berkas dalam bentuk polos. */
const RESOLVABLE = /(^|\.)desustream\.(net|com)$/i

interface Mirror {
  id: number
  index: number
  quality: string
  host: string
}

class OtakudesuSource extends ParsedAnimeSource implements ConfigurableSource {
  readonly id = 'otakudesu'
  readonly name = 'Otakudesu'
  readonly lang = 'id'
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
        summary: 'Otakudesu berganti domain cukup sering; isi yang sedang aktif',
        default: DEFAULT_BASE_URL,
        placeholder: DEFAULT_BASE_URL,
      },
    ]
  }

  // --- Katalog ---------------------------------------------------------------

  /**
   * Otakudesu tidak punya daftar terpopuler sama sekali. "Populer" dipetakan ke
   * katalog anime tamat — daftar terbesar yang ada — dan "Terbaru" ke daftar
   * ongoing, yang memang terurut menurut episode yang paling baru rilis.
   */
  protected popularRequest(page: number): HttpRequest {
    return this.get(`/complete-anime/page/${page}/`)
  }

  protected override latestRequest(page: number): HttpRequest {
    return this.get(`/ongoing-anime/page/${page}/`)
  }

  protected popularParse(doc: MDocument): EntriesPage<SAnime> {
    return {
      entries: selectAll(doc, 'div.venz ul li div.detpost').map((item) => this.toAnime(item)),
      hasNextPage: doc.querySelector('a.next.page-numbers') !== null,
    }
  }

  private toAnime(item: MElement): SAnime {
    const link = item.querySelector('div.thumb a')
    return compact<SAnime>({
      url: this.relative(attr(link, 'href')),
      title: cleanTitle(textOf(item, 'h2.jdlflm')),
      thumbnailUrl: imageSrc(item.querySelector('div.thumbz img')) || undefined,
    })
  }

  // --- Pencarian -------------------------------------------------------------

  protected searchRequest(_page: number, query: string): HttpRequest {
    return this.get(`/?s=${encodeURIComponent(query)}&post_type=anime`)
  }

  /** Halaman pencarian Otakudesu memang dibatasi 12 hasil dan tanpa paginasi. */
  protected searchParse(doc: MDocument): EntriesPage<SAnime> {
    const entries = selectAll(doc, 'ul.chivsrc li').map((item) =>
      compact<SAnime>({
        url: this.relative(attrOf(item, 'h2 a', 'href')),
        title: cleanTitle(textOf(item, 'h2 a')),
        thumbnailUrl: imageSrc(item.querySelector('img')) || undefined,
      }),
    )

    return { entries, hasNextPage: false }
  }

  // --- Detail ----------------------------------------------------------------

  protected detailsParse(doc: MDocument, anime: SAnime): SAnime {
    const info = 'div.infozingle p span'
    const genreRow = findWithText(doc, info, 'Genre')
    const genre = genreRow ? selectAll(genreRow, 'a').map((link) => text(link)) : []
    const total = num(labeledValue(doc, info, 'Total Episode'))

    return compact<SAnime>({
      ...anime,
      title: cleanTitle(labeledValue(doc, info, 'Judul')) || anime.title,
      thumbnailUrl: imageSrc(doc.querySelector('div.fotoanime img')) || anime.thumbnailUrl,
      description: textOf(doc, 'div.sinopc') || undefined,
      studio: labeledValue(doc, info, 'Studio') || undefined,
      genre: genre.length > 0 ? genre : undefined,
      status: STATUS_MAP[labeledValue(doc, info, 'Status').toLowerCase()] ?? 'unknown',
      totalEpisodes: total,
    })
  }

  // --- Episode ---------------------------------------------------------------

  protected episodeListParse(doc: MDocument): SEpisode[] {
    const episodes: SEpisode[] = []

    for (const block of selectAll(doc, 'div.episodelist')) {
      // Halaman detail memuat dua blok dengan markup identik: daftar batch
      // (satu tautan berisi seluruh seri) dan daftar episode. Yang membedakan
      // hanya judul di atasnya.
      if (/batch/i.test(textOf(block, 'span.monktit'))) continue

      for (const item of selectAll(block, 'ul li')) {
        const link = item.querySelector('span a')
        const href = attr(link, 'href')
        if (!href) continue

        const name = text(link)
        episodes.push(
          compact<SEpisode>({
            url: this.relative(href),
            name,
            episodeNumber: num(firstMatch(/episode\s+(\d+(?:\.\d+)?)/i, name)),
            dateUpload: parseIndonesianDate(textOf(item, 'span.zeebr')),
          }),
        )
      }
    }

    return episodes
  }

  // --- Video -----------------------------------------------------------------

  /**
   * Tiga langkah, dan tidak satu pun bisa dilewati:
   *
   * 1. Halaman episode membawa dua "action" WordPress di dalam script inline —
   *    satu untuk meminta nonce, satu untuk menukar mirror. Keduanya hash yang
   *    berubah tiap beberapa waktu, jadi harus dibaca dari halamannya, bukan
   *    ditanam di sini.
   * 2. Nonce diminta sekali, lalu dipakai untuk semua mirror.
   * 3. Tiap tautan mirror menyimpan `{id, i, q}` sebagai JSON base64; menukarnya
   *    menghasilkan potongan HTML berisi iframe player.
   *
   * Iframe dari host yang belum ada resolver-nya tetap dikembalikan sebagai
   * `type: 'embed'` — lebih baik pemutar menampilkan halaman aslinya daripada
   * episode tanpa satu pun pilihan video.
   */
  protected async videoListParse(doc: MDocument, res: HttpResponse): Promise<SVideo[]> {
    const scripts = selectAll(doc, 'script')
      .map((script) => script.textContent ?? '')
      .join('\n')

    const nonceAction = firstMatch(/data:\{action:"([0-9a-f]{16,})"\}/, scripts)
    const mirrorAction = firstMatch(/nonce:[^,]+,action:"([0-9a-f]{16,})"/, scripts)

    const videos: SVideo[] = []

    // Player bawaan halaman sudah terisi tanpa perlu satu request pun; ini
    // jaring pengaman kalau alur AJAX di bawah gagal seluruhnya.
    const defaultEmbed = attrOf(doc, 'div#pembed div.responsive-embed-stream iframe', 'src')
    if (defaultEmbed) {
      videos.push(...(await this.resolveEmbed(defaultEmbed, 'Default', res.url)))
    }

    const mirrors = this.readMirrors(doc)
    if (nonceAction && mirrorAction && mirrors.length > 0) {
      const nonce = await this.requestNonce(nonceAction, res.url)
      const resolved = await mapLimit(mirrors, 3, async (mirror) => {
        try {
          const embed = await this.requestMirror(mirror, mirrorAction, nonce, res.url)
          return embed
            ? await this.resolveEmbed(embed, `${mirror.quality} · ${mirror.host}`, res.url)
            : []
        } catch {
          // Satu mirror mati adalah keadaan normal di situs seperti ini; yang
          // lain tetap harus sampai ke pemutar.
          return []
        }
      })
      videos.push(...resolved.flat())
    }

    if (videos.length === 0) throw new Error('Otakudesu tidak memberi satu pun tautan video')

    // Berkas langsung didahulukan; di antara sesamanya, resolusi tertinggi dulu.
    return videos.sort((a, b) => {
      const kind = Number(a.type === 'embed') - Number(b.type === 'embed')
      return kind !== 0 ? kind : qualityRank(b.quality) - qualityRank(a.quality)
    })
  }

  private readMirrors(doc: MDocument): Mirror[] {
    return selectAll(doc, 'div.mirrorstream a[data-content]').flatMap((link) => {
      try {
        const payload: unknown = JSON.parse(decodeBase64(attr(link, 'data-content')))
        const id = num(get(payload, 'id'))
        const index = num(get(payload, 'i'))
        if (id === undefined || index === undefined) return []
        return [{ id, index, quality: str(get(payload, 'q'), 'Mirror'), host: text(link) }]
      } catch {
        return []
      }
    })
  }

  private async requestNonce(action: string, referer: string): Promise<string> {
    const payload = await this.postAjax(`action=${action}`, referer)
    const nonce = str(get(payload, 'data'))
    if (!nonce) throw new Error('Otakudesu tidak mengeluarkan nonce untuk halaman ini')
    return nonce
  }

  private async requestMirror(
    mirror: Mirror,
    action: string,
    nonce: string,
    referer: string,
  ): Promise<string> {
    const payload = await this.postAjax(
      `id=${mirror.id}&i=${mirror.index}&q=${encodeURIComponent(mirror.quality)}` +
        `&nonce=${encodeURIComponent(nonce)}&action=${action}`,
      referer,
    )

    const encoded = str(get(payload, 'data'))
    if (!encoded) return ''
    return attrOf(parseHtml(decodeBase64(encoded)), 'iframe', 'src')
  }

  private async postAjax(body: string, referer: string): Promise<unknown> {
    const res = await this.http.post(`${this.baseUrl}/wp-admin/admin-ajax.php`, body, {
      ...this.headers(),
      Referer: referer,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    })

    try {
      return JSON.parse(res.body)
    } catch {
      return undefined
    }
  }

  /**
   * Halaman embed milik Otakudesu sendiri masih menaruh URL berkas dalam bentuk
   * polos — entah sebagai `file:"…"` di script, entah sebagai `<source src>`.
   * Host lain dilewatkan apa adanya ke pemutar.
   */
  private async resolveEmbed(
    embedUrl: string,
    quality: string,
    referer: string,
  ): Promise<SVideo[]> {
    const url = absoluteUrl(this.baseUrl, embedUrl)
    const headers = { ...this.headers(), Referer: referer }

    if (!hostMatches(url, RESOLVABLE)) return [{ url, quality, type: 'embed', headers }]

    const res = await this.http.get(url, headers)
    const embedDoc = parseHtml(res.body)
    const direct =
      firstMatch(/file\s*:\s*"([^"]+)"/, res.body) ||
      attrOf(embedDoc, 'video source', 'src') ||
      attrOf(embedDoc, 'video', 'src')

    if (!direct) return [{ url, quality, type: 'embed', headers }]

    return [
      {
        url: direct,
        quality,
        type: direct.includes('.m3u8') ? 'hls' : 'mp4',
        headers: { ...this.headers(), Referer: new URL(url).origin + '/' },
      },
    ]
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

function hostMatches(url: string, pattern: RegExp): boolean {
  try {
    return pattern.test(new URL(url).hostname)
  } catch {
    return false
  }
}

/** "Boruto … Subtitle Indonesia" → "Boruto …". Akhiran itu ada di setiap judul. */
function cleanTitle(title: string): string {
  return title.replace(/\s*(subtitle indonesia|sub indo)\s*$/i, '').trim()
}

function qualityRank(quality: string): number {
  return num(firstMatch(/(\d{3,4})p/i, quality)) ?? 0
}

/** "12 Agustus,2026" — format tanggal khas tema ini, bukan ISO. */
function parseIndonesianDate(value: string): number | undefined {
  const match = /(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})/.exec(value)
  if (!match) return undefined

  const [, day, month, year] = match
  const index = MONTHS[(month ?? '').toLowerCase()]
  if (index === undefined || !day || !year) return undefined

  return Date.UTC(Number(year), index, Number(day))
}

const factory: SourceFactory = (ctx) => [new OtakudesuSource(ctx)]

export default factory
