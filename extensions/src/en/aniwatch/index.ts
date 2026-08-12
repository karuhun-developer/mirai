import type {
  ConfigurableSource,
  EntriesPage,
  FilterList,
  HttpRequest,
  SAnime,
  SEpisode,
  SourceContext,
  SourceFactory,
  SourcePreference,
  SStatus,
  STrack,
  SVideo,
} from '@mirai/extension-api'
import type { MDocument, MElement } from '@mirai/extension-lib'
import {
  absoluteUrl,
  arr,
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
  select,
  selectAll,
  selectedOption,
  str,
  text,
  textOf,
} from '@mirai/extension-lib'

/**
 * Aniwatch — tema WordPress "Zoro-Tv", jadi separuh datanya HTML dan separuhnya
 * REST API milik tema itu (`/wp-json/hianime/v1/`). Daftar episode dan daftar
 * server memang cuma ada di API; halaman detail tidak memuat keduanya sama
 * sekali karena browser mengambilnya belakangan lewat AJAX.
 */

const DEFAULT_BASE_URL = 'https://aniwatch.co.at'

/** Daftar yang tersedia; semuanya memakai markup kartu yang sama. */
const LISTS = [
  { label: 'Sedang tayang', value: '/top-airing/' },
  { label: 'Terpopuler', value: '/most-popular-anime/' },
  { label: 'Baru diperbarui', value: '/recently-updated/' },
  { label: 'A-Z', value: '/az-list/' },
]

/** Rantai pembungkus terpanjang yang pernah terlihat dua lompatan; satu cadangan. */
const MAX_EMBED_HOPS = 3

const STATUS_MAP: Record<string, SStatus> = {
  'currently airing': 'ongoing',
  'finished airing': 'completed',
  'not yet aired': 'unknown',
}

interface Server {
  label: string
  /** `sub` atau `dub`; ikut jadi bagian label kualitas. */
  audio: string
  url: string
}

class AniwatchSource extends ParsedAnimeSource implements ConfigurableSource {
  readonly id = 'aniwatch'
  readonly name = 'Aniwatch'
  readonly lang = 'en'
  override readonly supportsLatest = true

  readonly baseUrl: string
  private readonly preferDub: boolean

  constructor(ctx: SourceContext) {
    super(ctx)
    this.baseUrl = ctx.preferences.getString('baseUrl', DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.preferDub = ctx.preferences.getBoolean('preferDub', false)
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
      {
        type: 'switch',
        key: 'preferDub',
        title: 'Utamakan dub',
        summary: 'Menaruh server dub di urutan pertama pemutar',
        default: false,
      },
    ]
  }

  getFilterList(): FilterList {
    return [select('list', 'Daftar', LISTS)]
  }

  // --- Katalog ---------------------------------------------------------------

  /**
   * Paginasinya lewat `?anime-page=`, bukan `/page/N/` seperti WordPress pada
   * umumnya — segmen `/page/N/` diterima server tapi diabaikan, jadi memakainya
   * berarti halaman 2 dan seterusnya diam-diam mengulang halaman 1.
   */
  private listRequest(path: string, page: number): HttpRequest {
    return this.get(`${path}?anime-page=${page}`)
  }

  protected popularRequest(page: number): HttpRequest {
    return this.listRequest('/most-popular-anime/', page)
  }

  protected override latestRequest(page: number): HttpRequest {
    return this.listRequest('/recently-updated/', page)
  }

  protected searchRequest(page: number, query: string, filters: FilterList): HttpRequest {
    if (!query.trim()) {
      return this.listRequest(selectedOption(filters, 'list')?.value ?? '/az-list/', page)
    }
    return this.get(`/?s=${encodeURIComponent(query.trim())}&anime-page=${page}`)
  }

  protected popularParse(doc: MDocument): EntriesPage<SAnime> {
    const entries = selectAll(doc, 'div.film_list-wrap div.flw-item').flatMap((item) => {
      const anime = this.toAnime(item)
      return anime ? [anime] : []
    })

    return {
      entries,
      // Tombol "›" hanya dirender kalau memang masih ada halaman berikutnya.
      hasNextPage: findWithText(doc, 'a.page-link', '›') !== undefined,
    }
  }

  protected searchParse(doc: MDocument): EntriesPage<SAnime> {
    return this.popularParse(doc)
  }

  /**
   * Tautan di kartu menunjuk ke halaman episode terbaru, yang berubah tiap kali
   * ada episode baru — tidak bisa dipakai sebagai identitas entri di library.
   * Yang stabil adalah id post anime di `data-id`; `/?p=<id>` adalah permalink
   * WordPress yang selalu mengarah ke halaman serinya, dan sekaligus membuat id
   * tersebut ikut tersimpan sehingga daftar episode tidak perlu request tambahan.
   */
  private toAnime(item: MElement): SAnime | undefined {
    const poster = item.querySelector('a.film-poster-ahref')
    const animeId = attr(poster, 'data-id')
    if (!animeId) return undefined

    return compact<SAnime>({
      url: `/?p=${animeId}`,
      title: attr(poster, 'title') || textOf(item, 'h3.film-name a'),
      thumbnailUrl: imageSrc(item.querySelector('img.film-poster-img')) || undefined,
    })
  }

  // --- Detail ----------------------------------------------------------------

  protected detailsParse(doc: MDocument, anime: SAnime): SAnime {
    const info = 'div.anisc-info div.item'
    const genreRow = findWithText(doc, `${info}.item-list`, 'Genres')
    const genre = genreRow ? selectAll(genreRow, 'a').map((link) => text(link)) : []
    const status = labeledValue(doc, info, 'Status').toLowerCase()

    return compact<SAnime>({
      ...anime,
      title: textOf(doc, 'h2.film-name') || anime.title,
      thumbnailUrl: imageSrc(doc.querySelector('div.anisc-poster img')) || anime.thumbnailUrl,
      description: textOf(doc, 'div.item-title div.text') || undefined,
      studio: labeledValue(doc, info, 'Studios') || undefined,
      genre: genre.length > 0 ? genre : undefined,
      status: STATUS_MAP[status] ?? 'unknown',
      totalEpisodes: num(textOf(doc, 'div.film-stats div.tick-item.tick-eps')),
    })
  }

  // --- Episode ---------------------------------------------------------------

  /**
   * Daftar episode datang sebagai potongan HTML di dalam JSON, bukan JSON
   * terstruktur — jadi dipungut dari `url` (yang membawa id anime) lalu
   * di-parse ulang, bukan lewat `episodeListRequest` bawaan kelas induk.
   */
  override async getEpisodeList(anime: SAnime): Promise<SEpisode[]> {
    const fragment = await this.fetchFragment(`/episode/list/${idOf(anime.url)}`)

    return selectAll(fragment, 'a.ssl-item.ep-item').flatMap((item) => {
      const episodeId = attr(item, 'data-id')
      if (!episodeId) return []

      const number = num(attr(item, 'data-number'))
      const name = textOf(item, 'div.ep-name') || attr(item, 'title')

      return [
        compact<SEpisode>({
          url: `/watch/${episodeId}`,
          name: number === undefined ? name : `Episode ${number}${name ? ` — ${name}` : ''}`,
          episodeNumber: number,
          filler:
            item.getAttribute('class')?.includes('ssl-item-filler') === true ? true : undefined,
        }),
      ]
    })
  }

  protected episodeListParse(): SEpisode[] {
    throw new Error('tidak dipakai: daftar episode Aniwatch diambil lewat REST API')
  }

  // --- Video -----------------------------------------------------------------

  override async getVideoList(episode: SEpisode): Promise<SVideo[]> {
    const fragment = await this.fetchFragment(`/episode/servers/${idOf(episode.url)}`)
    const servers = this.readServers(fragment)
    if (servers.length === 0) throw new Error('Aniwatch tidak menyediakan server untuk episode ini')

    const resolved = await mapLimit(servers, 3, async (server) => {
      try {
        return await this.resolveServer(server)
      } catch {
        // Server mati adalah hal biasa; sisanya tetap harus sampai ke pemutar.
        return []
      }
    })

    const videos = resolved.flat()
    if (videos.length === 0) throw new Error('Tidak ada server Aniwatch yang bisa diresolusi')
    return videos
  }

  protected videoListParse(): Promise<SVideo[]> {
    throw new Error('tidak dipakai: daftar server Aniwatch diambil lewat REST API')
  }

  private readServers(fragment: MDocument): Server[] {
    const servers = selectAll(fragment, 'div.server-item[data-hash]').flatMap((item) => {
      const hash = attr(item, 'data-hash')
      if (!hash) return []
      try {
        return [
          {
            label: attr(item, 'data-server-name') || 'Server',
            audio: attr(item, 'data-type') || 'sub',
            url: decodeBase64(hash),
          },
        ]
      } catch {
        return []
      }
    })

    const wanted = this.preferDub ? 'dub' : 'sub'
    return servers.sort((a, b) => Number(b.audio === wanted) - Number(a.audio === wanted))
  }

  /**
   * `data-hash` menunjuk ke pembungkus, dan pembungkus itu kadang membungkus
   * pembungkus lagi: server "T-Cloud" ternyata cuma satu halaman berisi iframe
   * ke server "HD-1". Karena itu iframe diikuti berulang sampai ketemu halaman
   * player yang membawa `data-id` — kalau berhenti di lompatan pertama, dua
   * dari tiga server selalu berakhir jadi embed padahal sumbernya bisa
   * diresolusi jadi HLS.
   */
  private async resolveServer(server: Server): Promise<SVideo[]> {
    const quality = `${server.label} · ${server.audio.toUpperCase()}`
    let url = server.url
    let referer = `${this.baseUrl}/`
    let body = ''

    for (let hop = 0; hop < MAX_EMBED_HOPS; hop += 1) {
      const res = await this.http.get(url, { ...this.headers(), Referer: referer })
      body = res.body
      const doc = parseHtml(body)

      const playerId = attrOf(doc, '[data-id]', 'data-id')
      if (playerId) return this.fetchSources(res.url, playerId, quality)

      const next = attrOf(doc, 'iframe', 'src')
      if (!next) break

      referer = url
      url = absoluteUrl(url, next)
    }

    // Server mati menjawab dengan halaman "Error" yang tetap 200 dan tanpa
    // player apa pun. Menyerahkannya sebagai embed berarti pengguna mengetuk
    // pilihan yang dijamin kosong, jadi lebih baik tidak ditawarkan.
    if (!/<video|jwplayer\(|file\s*:/i.test(body)) return []
    return [{ url, quality, type: 'embed', headers: { ...this.headers(), Referer: referer } }]
  }

  /** `getSources` menukar id internal player jadi playlist HLS + trek subtitle. */
  private async fetchSources(playerUrl: string, id: string, quality: string): Promise<SVideo[]> {
    const origin = new URL(playerUrl).origin
    const payload = await this.http.getJson(`${origin}/stream/getSources?id=${id}`, {
      ...this.headers(),
      Referer: playerUrl,
      'X-Requested-With': 'XMLHttpRequest',
    })

    const file = str(get(payload, 'sources', 'file'))
    if (!file) return []

    const subtitles: STrack[] = arr(get(payload, 'tracks'))
      .filter((track) => str(get(track, 'kind')) === 'captions')
      .map((track) => ({ url: str(get(track, 'file')), label: str(get(track, 'label'), 'Sub') }))
      .filter((track) => track.url !== '')

    return [
      compact<SVideo>({
        url: file,
        quality,
        type: file.includes('.m3u8') ? 'hls' : 'mp4',
        headers: { ...this.headers(), Referer: `${origin}/` },
        subtitles: subtitles.length > 0 ? subtitles : undefined,
      }),
    ]
  }

  // --- REST API tema ---------------------------------------------------------

  /** Endpoint tema membungkus HTML di dalam JSON: `{ status, html }`. */
  private async fetchFragment(path: string): Promise<MDocument> {
    const payload = await this.http.getJson(`${this.baseUrl}/wp-json/hianime/v1${path}`, {
      ...this.headers(),
      'X-Requested-With': 'XMLHttpRequest',
    })

    const html = str(get(payload, 'html'))
    if (!html) throw new Error(`Aniwatch mengembalikan potongan kosong untuk ${path}`)
    return parseHtml(html)
  }
}

/** `/?p=1014` maupun `/watch/1027` sama-sama menyimpan idnya di ekor URL. */
function idOf(url: string): string {
  return firstMatch(/(\d+)\s*$/, url) ?? ''
}

const factory: SourceFactory = (ctx) => [new AniwatchSource(ctx)]

export default factory
