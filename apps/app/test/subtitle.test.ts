import { describe, expect, it } from 'vitest'
import { toVtt } from '../src/services/subtitle.ts'

describe('toVtt', () => {
  it('membiarkan berkas yang sudah WebVTT', () => {
    const source = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHalo\n'
    expect(toVtt(source)).toBe(source)
  })

  it('mengubah koma milidetik SRT jadi titik dan menambah header', () => {
    const srt = '1\r\n00:00:01,500 --> 00:00:03,250\r\nSelamat datang\r\n'
    const vtt = toVtt(srt)

    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true)
    expect(vtt).toContain('00:00:01.500 --> 00:00:03.250')
    expect(vtt).toContain('Selamat datang')
  })

  it('melengkapi jam SRT yang cuma satu digit', () => {
    expect(toVtt('1\n0:00:01,500 --> 0:00:03,000\nHai\n')).toContain(
      '00:00:01.500 --> 00:00:03.000',
    )
  })

  it('membaca kolom Dialogue ASS lewat baris Format, bukan urutan tetap', () => {
    // Kolom Start/End di sini bertukar tempat dengan kebiasaan umum: kalau
    // pembacanya menganggap Start selalu kolom kedua, takarirnya muncul acak.
    const ass = [
      '[Script Info]',
      '[Events]',
      'Format: Layer, End, Start, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:09.00,0:00:07.50,Default,,0,0,0,,Kamu terlambat',
    ].join('\n')

    expect(toVtt(ass)).toContain('00:00:07.500 --> 00:00:09.000')
  })

  it('membuang tag gaya dan mengubah \\N jadi baris baru', () => {
    const ass = [
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\an8\\i1}Baris satu\\NBaris dua',
    ].join('\n')

    const vtt = toVtt(ass)
    expect(vtt).toContain('Baris satu\nBaris dua')
    expect(vtt).not.toContain('{')
  })

  it('mempertahankan koma di dalam teks dialog', () => {
    const ass = [
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Tunggu, jangan pergi',
    ].join('\n')

    expect(toVtt(ass)).toContain('Tunggu, jangan pergi')
  })

  it('melewati baris Dialogue yang waktunya tidak terbaca', () => {
    const ass = [
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,rusak,0:00:02.00,Default,,0,0,0,,Hilang',
      'Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,Ada',
    ].join('\n')

    const vtt = toVtt(ass)
    expect(vtt).not.toContain('Hilang')
    expect(vtt).toContain('Ada')
  })
})
