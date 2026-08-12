import { describe, expect, it } from 'vitest'
import {
  createLocalLoader,
  createProxyLoader,
  type LoaderCallbacksLike,
  type LoaderContextLike,
} from '../src/services/hlsLoader.ts'

/** Alamat yang benar-benar diambil dari jaringan, direkam per instance. */
const requested: string[] = []

/** Loader tiruan menggantikan XHR hls.js: cukup mencatat lalu balas sukses. */
class FakeLoader {
  load(context: LoaderContextLike, _config: unknown, callbacks: LoaderCallbacksLike): void {
    requested.push(context.url)
    // Loader sungguhan melaporkan alamat yang benar-benar diambil; itulah yang
    // harus ditimpa supaya URL relatif di playlist tidak tersesat ke proxy.
    callbacks.onSuccess({ url: context.url }, {}, context, null)
  }
}

const proxy = (url: string) => `http://proxy/stream?url=${encodeURIComponent(url)}`

describe('createProxyLoader', () => {
  it('mengambil lewat proxy tapi melapor URL asli ke hls.js', () => {
    requested.length = 0
    const Loader = createProxyLoader(FakeLoader, proxy)
    const loader = new Loader({})

    const context: LoaderContextLike = { url: 'https://cdn.test/master.m3u8' }
    let reported = ''
    loader.load(context, {}, {
      onSuccess: (response) => {
        reported = response.url
      },
    } as LoaderCallbacksLike)

    expect(requested).toEqual(['http://proxy/stream?url=https%3A%2F%2Fcdn.test%2Fmaster.m3u8'])
    // Basis URL relatif di dalam playlist: harus alamat asli, bukan proxy.
    expect(reported).toBe('https://cdn.test/master.m3u8')
    expect(context.url).toBe('https://cdn.test/master.m3u8')
  })

  it('tidak membungkus dua kali saat hls.js mencoba ulang', () => {
    requested.length = 0
    const Loader = createProxyLoader(FakeLoader, proxy)
    const loader = new Loader({})

    const context: LoaderContextLike = { url: 'https://cdn.test/seg-1.ts' }
    const callbacks = { onSuccess: () => {} } as LoaderCallbacksLike

    loader.load(context, {}, callbacks)
    loader.load(context, {}, callbacks)

    expect(requested[0]).toBe(requested[1])
    expect(requested[1]).not.toContain('proxy%2Fstream')
  })

  it('jadi lapisan kosong kalau resolver mengembalikan URL apa adanya', () => {
    requested.length = 0
    const Loader = createProxyLoader(FakeLoader, (url) => url)
    const loader = new Loader({})

    loader.load({ url: 'https://cdn.test/native.m3u8' }, {}, {
      onSuccess: () => {},
    } as LoaderCallbacksLike)

    expect(requested).toEqual(['https://cdn.test/native.m3u8'])
  })
})

describe('createLocalLoader', () => {
  /** Alamat berkas yang dibuka dan dilepas — inilah yang dijaga loader lokal. */
  const opened: string[] = []
  const closed: string[] = []

  function makeLoader(missing = false) {
    requested.length = 0
    opened.length = 0
    closed.length = 0

    return createLocalLoader(
      FakeLoader,
      async (path) => {
        if (missing) return null
        const url = `blob:${path}`
        opened.push(url)
        return url
      },
      (url) => closed.push(url),
    )
  }

  it('menukar alamat lokal jadi alamat berkas lalu melepasnya lagi', async () => {
    const loader = new (makeLoader())({})
    const context: LoaderContextLike = { url: 'mirai-local://downloads/ep/0001.ts' }

    let reported = ''
    loader.load(context, {}, {
      onSuccess: (response) => {
        reported = response.url
      },
    } as LoaderCallbacksLike)
    await Promise.resolve()

    expect(requested).toEqual(['blob:downloads/ep/0001.ts'])
    // Yang dilaporkan ke hls.js tetap alamat lokal: `blob:`-nya sudah dicabut.
    expect(reported).toBe('mirai-local://downloads/ep/0001.ts')
    expect(closed).toEqual(opened)
  })

  it('meneruskan alamat non-lokal apa adanya', async () => {
    const loader = new (makeLoader())({})

    loader.load({ url: 'blob:playlist' }, {}, { onSuccess: () => {} } as LoaderCallbacksLike)
    await Promise.resolve()

    expect(requested).toEqual(['blob:playlist'])
    expect(opened).toEqual([])
  })

  it('melapor gagal, bukan menggantung, kalau berkasnya hilang', async () => {
    const loader = new (makeLoader(true))({})

    let error = ''
    loader.load({ url: 'mirai-local://downloads/ep/0002.ts' }, {}, {
      onSuccess: () => {},
      onError: (info) => {
        error = info.text
      },
    } as LoaderCallbacksLike)
    await Promise.resolve()

    expect(requested).toEqual([])
    expect(error).toContain('downloads/ep/0002.ts')
  })

  it('membuka berkas yang sama lagi waktu hls.js mencoba ulang', async () => {
    const Loader = makeLoader()
    const loader = new Loader({})

    const context: LoaderContextLike = { url: 'mirai-local://downloads/ep/0004.ts' }
    const callbacks = { onSuccess: () => {} } as LoaderCallbacksLike

    loader.load(context, {}, callbacks)
    await Promise.resolve()
    // Percobaan kedua memakai `context` yang alamatnya sudah tertimpa `blob:`
    // yang barusan dicabut; yang benar adalah membuka berkasnya sekali lagi.
    loader.load(context, {}, callbacks)
    await Promise.resolve()

    expect(requested).toEqual(['blob:downloads/ep/0004.ts', 'blob:downloads/ep/0004.ts'])
    expect(closed).toHaveLength(2)
  })

  it('tidak jadi mengambil berkas yang permintaannya keburu dibatalkan', async () => {
    const Loader = makeLoader()
    const loader = new Loader({})

    loader.load({ url: 'mirai-local://downloads/ep/0003.ts' }, {}, {
      onSuccess: () => {},
    } as LoaderCallbacksLike)
    loader.abort?.()
    await Promise.resolve()

    expect(requested).toEqual([])
    // Alamat yang terlanjur dibuka tetap wajib dilepas.
    expect(closed).toEqual(opened)
  })
})
