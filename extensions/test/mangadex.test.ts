import { beforeEach, describe, expect, it } from 'vitest'
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
  MangaSource,
  PreferenceStore,
  SourceContext,
} from '@mirai/extension-api'
import { isConfigurable, isMangaSource } from '@mirai/extension-api'
import factory from '../src/all/mangadex/index.ts'

/**
 * Test kontrak MangaDex.
 *
 * HTTP-nya di-stub, bukan dipanggil sungguhan: test yang bergantung pada API
 * pihak ketiga akan merah setiap kali jaringan atau situsnya sedang rewel, dan
 * yang mau dibuktikan di sini adalah pemetaan respons → model, bukan uptime
 * MangaDex.
 */

const MANGA_LIST = {
  result: 'ok',
  data: [
    {
      id: 'abc-123',
      attributes: { title: { en: 'Blue Lock', id: 'Blue Lock' } },
      relationships: [{ type: 'cover_art', attributes: { fileName: 'cover.jpg' } }],
    },
    {
      id: 'def-456',
      attributes: { title: { ja: '呪術廻戦' } },
      relationships: [],
    },
  ],
  limit: 24,
  offset: 0,
  total: 50,
}

const MANGA_DETAIL = {
  result: 'ok',
  data: {
    id: 'abc-123',
    attributes: {
      title: { en: 'Blue Lock' },
      description: { en: 'Sepak bola.', id: 'Tentang sepak bola.' },
      status: 'ongoing',
      tags: [{ attributes: { name: { en: 'Sports' } } }, { attributes: { name: { en: 'Drama' } } }],
    },
    relationships: [
      { type: 'cover_art', attributes: { fileName: 'cover.jpg' } },
      { type: 'author', attributes: { name: 'Muneyuki Kaneshiro' } },
      { type: 'artist', attributes: { name: 'Yusuke Nomura' } },
    ],
  },
}

const CHAPTER_FEED = {
  result: 'ok',
  data: [
    {
      id: 'ch-1',
      attributes: {
        chapter: '12.5',
        volume: '3',
        title: 'Ekstra',
        publishAt: '2024-05-01T00:00:00+00:00',
      },
      relationships: [{ type: 'scanlation_group', attributes: { name: 'Tim Sub' } }],
    },
    {
      id: 'ch-2',
      attributes: { chapter: '', volume: '', title: '', publishAt: 'tanggal-rusak' },
      relationships: [],
    },
  ],
  limit: 500,
  offset: 0,
  total: 2,
}

const AT_HOME = {
  result: 'ok',
  baseUrl: 'https://cdn.test',
  chapter: {
    hash: 'hash123',
    data: ['1.png', '2.png'],
    dataSaver: ['1s.jpg', '2s.jpg'],
  },
}

/** Mengembalikan fixture berdasarkan bentuk URL; mencatat apa yang diminta. */
function createHttp(calls: string[]): HttpClient {
  const notImplemented = (): never => {
    throw new Error('MangaDex hanya boleh memakai getJson()')
  }

  return {
    request: notImplemented as unknown as (req: HttpRequest) => Promise<HttpResponse>,
    get: notImplemented as unknown as HttpClient['get'],
    post: notImplemented as unknown as HttpClient['post'],
    getJson(url: string): Promise<unknown> {
      calls.push(url)
      if (url.includes('/at-home/server/')) return Promise.resolve(AT_HOME)
      if (url.includes('/feed')) return Promise.resolve(CHAPTER_FEED)
      if (/\/manga\/[^/?]+\?/.test(url)) return Promise.resolve(MANGA_DETAIL)
      if (url.includes('/manga?')) return Promise.resolve(MANGA_LIST)
      throw new Error(`URL tak terduga: ${url}`)
    },
  }
}

function createPrefs(overrides: Record<string, string | boolean | string[]> = {}): PreferenceStore {
  return {
    getString: (key, fallback) => (typeof overrides[key] === 'string' ? overrides[key] : fallback),
    getBoolean: (key, fallback) =>
      typeof overrides[key] === 'boolean' ? overrides[key] : fallback,
    getStringList: (key, fallback) =>
      Array.isArray(overrides[key]) ? [...overrides[key]] : [...fallback],
  }
}

function build(overrides?: Record<string, string | boolean | string[]>): {
  source: MangaSource
  calls: string[]
} {
  const calls: string[] = []
  const ctx: SourceContext = {
    apiVersion: 1,
    http: createHttp(calls),
    preferences: createPrefs(overrides),
  }

  const sources = factory(ctx)
  const source = sources[0]
  if (!source || !isMangaSource(source))
    throw new Error('MangaDex harus mengembalikan manga source')
  return { source, calls }
}

describe('MangaDex memenuhi kontrak source', () => {
  let source: MangaSource
  let calls: string[]

  beforeEach(() => {
    ;({ source, calls } = build())
  })

  it('mengekspor tepat satu source dengan identitas yang stabil', () => {
    expect(source.id).toBe('mangadex')
    expect(source.kind).toBe('manga')
    expect(source.supportsLatest).toBe(true)
  })

  it('mendeklarasikan preferences lewat ConfigurableSource', () => {
    expect(isConfigurable(source)).toBe(true)
    const keys = isConfigurable(source) ? source.getPreferences().map((pref) => pref.key) : []
    expect(keys).toEqual(['lang', 'contentRating', 'dataSaver'])
  })

  it('memetakan daftar populer jadi SManga beserta URL cover', async () => {
    const result = await source.getPopular(1)

    expect(result.entries).toHaveLength(2)
    expect(result.entries[0]).toEqual({
      url: '/manga/abc-123',
      title: 'Blue Lock',
      thumbnailUrl: 'https://uploads.mangadex.org/covers/abc-123/cover.jpg.256.jpg',
    })
    expect(calls[0]).toContain('order[followedCount]=desc')
  })

  it('menghilangkan thumbnailUrl kalau tidak ada cover_art, bukan mengisi string kosong', async () => {
    const result = await source.getPopular(1)
    expect(result.entries[1]).not.toHaveProperty('thumbnailUrl')
  })

  it('jatuh ke bahasa lain saat judul tidak tersedia dalam bahasa pilihan', async () => {
    const result = await source.getPopular(1)
    expect(result.entries[1]?.title).toBe('呪術廻戦')
  })

  it('menghitung hasNextPage dari offset dan total', async () => {
    const result = await source.getPopular(1)
    expect(result.hasNextPage).toBe(true)
  })

  it('meneruskan offset sesuai nomor halaman', async () => {
    await source.getPopular(3)
    expect(calls[0]).toContain('offset=48')
  })

  it('menerjemahkan filter jadi parameter API', async () => {
    const filters = source.getFilterList()
    const order = filters.find((filter) => filter.key === 'order')
    const author = filters.find((filter) => filter.key === 'author')
    if (order?.type === 'select') order.value = 2 // Judul (A-Z)
    if (author?.type === 'text') author.value = ' Kaneshiro '

    await source.getSearch(1, 'blue lock', filters)

    expect(calls[0]).toContain('title=blue%20lock')
    expect(calls[0]).toContain('order[title]=asc')
    expect(calls[0]).toContain('authorOrArtist=Kaneshiro')
  })

  it('mengabaikan filter yang tidak dikenal alih-alih melempar', async () => {
    await expect(
      source.getSearch(1, '', [
        { type: 'checkbox', key: 'dari-versi-lama', name: 'x', value: true },
      ]),
    ).resolves.toBeDefined()
  })

  it('melengkapi detail dengan author, artist, genre, dan status', async () => {
    const detail = await source.getDetails({ url: '/manga/abc-123', title: 'Blue Lock' })

    expect(detail.author).toBe('Muneyuki Kaneshiro')
    expect(detail.artist).toBe('Yusuke Nomura')
    expect(detail.genre).toEqual(['Sports', 'Drama'])
    expect(detail.status).toBe('ongoing')
    expect(detail.description).toBe('Tentang sepak bola.')
  })

  it('memakai bahasa dari preferences untuk memilih deskripsi', async () => {
    const { source: english } = build({ lang: 'en' })
    const detail = await english.getDetails({ url: '/manga/abc-123', title: 'Blue Lock' })
    expect(detail.description).toBe('Sepak bola.')
  })

  it('memetakan chapter beserta nomor, tanggal, dan scanlator', async () => {
    const chapters = await source.getChapterList({ url: '/manga/abc-123', title: 'Blue Lock' })

    expect(chapters[0]).toEqual({
      url: '/chapter/ch-1',
      name: 'Vol. 3 Chapter 12.5 — Ekstra',
      chapterNumber: 12.5,
      dateUpload: Date.parse('2024-05-01T00:00:00Z'),
      scanlator: 'Tim Sub',
    })
  })

  it('menyebut chapter tanpa nomor sebagai Oneshot dan tidak memalsukan metadata', async () => {
    const chapters = await source.getChapterList({ url: '/manga/abc-123', title: 'Blue Lock' })

    expect(chapters[1]?.name).toBe('Oneshot')
    expect(chapters[1]).not.toHaveProperty('chapterNumber')
    expect(chapters[1]).not.toHaveProperty('dateUpload')
  })

  it('meminta feed dalam bahasa terjemahan yang dipilih', async () => {
    const { source: english, calls: englishCalls } = build({ lang: 'en' })
    await english.getChapterList({ url: '/manga/abc-123', title: 'Blue Lock' })
    expect(englishCalls[0]).toContain('translatedLanguage[]=en')
  })

  it('menyusun URL halaman dari baseUrl at-home', async () => {
    const pages = await source.getPageList({ url: '/chapter/ch-1', name: 'Chapter 1' })

    expect(pages).toEqual([
      { index: 0, imageUrl: 'https://cdn.test/data/hash123/1.png' },
      { index: 1, imageUrl: 'https://cdn.test/data/hash123/2.png' },
    ])
  })

  it('memakai berkas data-saver kalau hemat kuota menyala', async () => {
    const { source: saver } = build({ dataSaver: true })
    const pages = await saver.getPageList({ url: '/chapter/ch-1', name: 'Chapter 1' })
    expect(pages[0]?.imageUrl).toBe('https://cdn.test/data-saver/hash123/1s.jpg')
  })
})

describe('MangaDex menyusuri feed chapter yang panjang', () => {
  /** Feed dibatasi 500 per request; judul panjang butuh beberapa putaran. */
  function feedPage(offset: number, count: number, total: number): unknown {
    return {
      result: 'ok',
      data: Array.from({ length: count }, (_, index) => ({
        id: `ch-${offset + index}`,
        attributes: { chapter: String(offset + index + 1), publishAt: '2024-05-01T00:00:00+00:00' },
        relationships: [],
      })),
      limit: 500,
      offset,
      total,
    }
  }

  function buildPaged(total: number): { source: MangaSource; calls: string[] } {
    const calls: string[] = []
    const ctx: SourceContext = {
      apiVersion: 1,
      preferences: createPrefs(),
      http: {
        request: (() => {
          throw new Error('tidak dipakai')
        }) as unknown as HttpClient['request'],
        get: (() => {
          throw new Error('tidak dipakai')
        }) as unknown as HttpClient['get'],
        post: (() => {
          throw new Error('tidak dipakai')
        }) as unknown as HttpClient['post'],
        getJson(url: string): Promise<unknown> {
          calls.push(url)
          const offset = Number(new URL(url, 'https://x.test').searchParams.get('offset') ?? 0)
          return Promise.resolve(feedPage(offset, Math.min(500, total - offset), total))
        },
      },
    }

    const source = factory(ctx)[0]
    if (!source || !isMangaSource(source)) throw new Error('bukan manga source')
    return { source, calls }
  }

  it('mengambil semua halaman feed sampai total terpenuhi', async () => {
    const { source, calls } = buildPaged(620)
    const chapters = await source.getChapterList({ url: '/manga/abc-123', title: 'Blue Lock' })

    expect(chapters).toHaveLength(620)
    expect(calls).toHaveLength(2)
    expect(calls[1]).toContain('offset=500')
  })

  it('berhenti setelah satu request kalau chapter-nya muat sekali ambil', async () => {
    const { calls, source } = buildPaged(12)
    await source.getChapterList({ url: '/manga/abc-123', title: 'Blue Lock' })
    expect(calls).toHaveLength(1)
  })

  it('tidak menggantung untuk judul tanpa chapter sama sekali', async () => {
    const { calls, source } = buildPaged(0)
    await expect(
      source.getChapterList({ url: '/manga/abc-123', title: 'Blue Lock' }),
    ).resolves.toEqual([])
    expect(calls).toHaveLength(1)
  })
})
