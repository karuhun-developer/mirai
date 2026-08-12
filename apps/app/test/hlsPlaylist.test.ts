import { describe, expect, it } from 'vitest'
import {
  LOCAL_SCHEME,
  isMasterPlaylist,
  localPathOf,
  localizePlaylist,
  parseVariants,
  planPlaylist,
  resolveUri,
} from '../src/services/hlsPlaylist.ts'

const MASTER = [
  '#EXTM3U',
  '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480,CODECS="avc1.4d401f,mp4a.40.2"',
  '480/index.m3u8',
  '#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720',
  'https://other.test/720/index.m3u8',
  '#EXT-X-STREAM-INF:BANDWIDTH=5000000,NAME="Full HD"',
  '1080/index.m3u8',
].join('\n')

const MEDIA = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:10',
  '#EXT-X-KEY:METHOD=AES-128,URI="../keys/enc.key",IV=0x0123456789abcdef',
  '#EXT-X-MAP:URI="init.mp4"',
  '#EXTINF:9.009,',
  'seg-1.ts',
  '#EXTINF:9.009,',
  '/hls/seg-2.ts?token=abc',
  '#EXTINF:3.003,',
  'https://cdn.test/hls/seg-3.ts',
  '#EXT-X-ENDLIST',
  '',
].join('\n')

const BASE = 'https://cdn.test/hls/720/index.m3u8'

describe('resolveUri', () => {
  it('membiarkan alamat yang sudah punya skema', () => {
    expect(resolveUri('https://a.test/x.ts', BASE)).toBe('https://a.test/x.ts')
    expect(resolveUri('data:text/plain,x', BASE)).toBe('data:text/plain,x')
  })

  it('menyelesaikan alamat relatif terhadap playlist-nya', () => {
    expect(resolveUri('seg-1.ts', BASE)).toBe('https://cdn.test/hls/720/seg-1.ts')
    expect(resolveUri('../seg-1.ts', BASE)).toBe('https://cdn.test/hls/seg-1.ts')
    expect(resolveUri('/seg-1.ts', BASE)).toBe('https://cdn.test/seg-1.ts')
    expect(resolveUri('//lain.test/seg-1.ts', BASE)).toBe('https://lain.test/seg-1.ts')
  })
})

describe('parseVariants', () => {
  it('mengenali master playlist', () => {
    expect(isMasterPlaylist(MASTER)).toBe(true)
    expect(isMasterPlaylist(MEDIA)).toBe(false)
  })

  it('memberi label yang bisa dicocokkan dengan setelan kualitas', () => {
    const variants = parseVariants(MASTER, 'https://cdn.test/hls/master.m3u8')
    expect(variants.map((variant) => variant.quality)).toEqual(['480p', '720p', 'Full HD'])
    expect(variants[0]?.url).toBe('https://cdn.test/hls/480/index.m3u8')
    expect(variants[1]?.url).toBe('https://other.test/720/index.m3u8')
    expect(variants[1]?.height).toBe(720)
  })

  it('tidak tersandung koma di dalam CODECS', () => {
    expect(parseVariants(MASTER, BASE)[0]?.bandwidth).toBe(800000)
  })
})

describe('planPlaylist', () => {
  const plan = planPlaylist(MEDIA, BASE)

  it('mengumpulkan segmen, kunci, dan segmen inisialisasi', () => {
    expect(plan.resources).toEqual([
      { url: 'https://cdn.test/hls/keys/enc.key', name: 'key-01.key', kind: 'key' },
      { url: 'https://cdn.test/hls/720/init.mp4', name: 'map-01.mp4', kind: 'map' },
      { url: 'https://cdn.test/hls/720/seg-1.ts', name: '0001.ts', kind: 'segment' },
      { url: 'https://cdn.test/hls/seg-2.ts?token=abc', name: '0002.ts', kind: 'segment' },
      { url: 'https://cdn.test/hls/seg-3.ts', name: '0003.ts', kind: 'segment' },
    ])
  })

  it('menulis ulang playlist ke nama berkas lokal tanpa menyentuh tag lain', () => {
    expect(plan.playlist).toContain(
      '#EXT-X-KEY:METHOD=AES-128,URI="key-01.key",IV=0x0123456789abcdef',
    )
    expect(plan.playlist).toContain('#EXT-X-MAP:URI="map-01.mp4"')
    expect(plan.playlist).toContain('#EXT-X-TARGETDURATION:10')
    expect(plan.playlist).toContain('#EXTINF:9.009,')
    expect(plan.playlist).not.toContain('cdn.test')
  })

  it('memakai satu berkas untuk URL yang muncul berkali-kali', () => {
    const repeated = planPlaylist(
      ['#EXTINF:9,', 'a.ts', '#EXTINF:9,', 'a.ts', '#EXTINF:9,', 'b.ts'].join('\n'),
      BASE,
    )
    expect(repeated.resources.map((resource) => resource.name)).toEqual(['0001.ts', '0002.ts'])
    expect(repeated.playlist.split('\n').filter((line) => line === '0001.ts')).toHaveLength(2)
  })

  it('melewatkan kunci tanpa URI', () => {
    const plain = planPlaylist(['#EXT-X-KEY:METHOD=NONE', '#EXTINF:9,', 'a.ts'].join('\n'), BASE)
    expect(plain.resources).toHaveLength(1)
    expect(plain.playlist).toContain('#EXT-X-KEY:METHOD=NONE')
  })

  it('menebak ekstensi dari alamatnya, dan jatuh ke .ts kalau tidak ada', () => {
    const mixed = planPlaylist(
      ['#EXTINF:9,', 'a.m4s', '#EXTINF:9,', 'https://cdn.test/segment?i=2'].join('\n'),
      BASE,
    )
    expect(mixed.resources.map((resource) => resource.name)).toEqual(['0001.m4s', '0002.ts'])
  })
})

describe('localizePlaylist', () => {
  const dir = 'downloads/otakudesu/naruto-1a2b3c4d/0001-episode-1-9f8e7d6c'

  it('mengubah nama berkas jadi alamat lokal yang absolut', () => {
    const local = localizePlaylist(planPlaylist(MEDIA, BASE).playlist, dir)

    expect(local).toContain(`URI="${LOCAL_SCHEME}${dir}/key-01.key"`)
    expect(local).toContain(`URI="${LOCAL_SCHEME}${dir}/map-01.mp4"`)
    expect(local).toContain(`${LOCAL_SCHEME}${dir}/0001.ts`)
    // Tag lain tidak boleh ikut berubah; hls.js membacanya apa adanya.
    expect(local).toContain('#EXT-X-ENDLIST')
    expect(local.split('\n').filter((line) => line.startsWith('#EXTINF'))).toHaveLength(3)
  })

  it('bisa dikembalikan jadi path berkas', () => {
    expect(localPathOf(`${LOCAL_SCHEME}${dir}/0001.ts`)).toBe(`${dir}/0001.ts`)
    expect(localPathOf('https://cdn.test/0001.ts')).toBeNull()
  })
})
