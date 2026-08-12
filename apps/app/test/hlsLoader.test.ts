import { describe, expect, it } from 'vitest'
import {
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
