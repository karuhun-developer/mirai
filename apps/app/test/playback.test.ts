import { describe, expect, it } from 'vitest'
import type { SVideoType } from '@mirai/extension-api'
import {
  formatTime,
  heightOf,
  isFinished,
  pickVideo,
  resumeAt,
  type PlayableVideo,
} from '../src/services/playback.ts'

function video(quality: string, type: SVideoType = 'hls'): PlayableVideo {
  return { url: `https://cdn.test/${quality}`, quality, type, subtitles: [] }
}

describe('isFinished', () => {
  it('menandai selesai di 90% durasi, bukan di detik terakhir', () => {
    // Episode 24 menit: ending mulai sekitar menit 22.
    expect(isFinished(1296, 1440)).toBe(true)
    expect(isFinished(1200, 1440)).toBe(false)
  })

  it('tidak menyimpulkan apa pun tanpa durasi yang sah', () => {
    expect(isFinished(100, 0)).toBe(false)
    expect(isFinished(100, Number.NaN)).toBe(false)
    expect(isFinished(100, Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('resumeAt', () => {
  it('melanjutkan di posisi tersimpan', () => {
    expect(resumeAt({ seen: 0, last_position: 640 }, 1440)).toBe(640)
  })

  it('mengulang dari awal untuk episode yang sudah ditonton', () => {
    expect(resumeAt({ seen: 1, last_position: 1400 }, 1440)).toBe(0)
  })

  it('mengulang dari awal kalau posisinya sudah melewati ambang selesai', () => {
    // App tertutup tepat sebelum tanda "selesai" sempat tertulis.
    expect(resumeAt({ seen: 0, last_position: 1430 }, 1440)).toBe(0)
  })

  it('tidak pernah mengembalikan posisi negatif', () => {
    expect(resumeAt({ seen: 0, last_position: -5 })).toBe(0)
  })
})

describe('heightOf', () => {
  it('membaca angka dari label apa adanya', () => {
    expect(heightOf('720p')).toBe(720)
    expect(heightOf('HD 1080P')).toBe(1080)
    expect(heightOf('Mirror 2 · 480p')).toBe(480)
  })

  it('mengembalikan undefined untuk label tanpa angka', () => {
    expect(heightOf('Default')).toBeUndefined()
    expect(heightOf('Streamtape')).toBeUndefined()
  })
})

describe('pickVideo', () => {
  it('memakai label yang sama persis kalau ada', () => {
    const videos = [video('360p'), video('720p'), video('1080p')]
    expect(pickVideo(videos, '720p')).toBe(1)
  })

  it('turun ke kualitas terdekat di bawah pilihan, bukan naik', () => {
    const videos = [video('360p'), video('1080p')]
    expect(pickVideo(videos, '720p')).toBe(0)
  })

  it('naik ke yang paling rendah kalau tidak ada yang di bawah', () => {
    const videos = [video('1080p'), video('720p')]
    expect(pickVideo(videos, '480p')).toBe(1)
  })

  it('melewati tipe embed selama masih ada berkas video sungguhan', () => {
    const videos = [video('Streamtape', 'embed'), video('480p')]
    expect(pickVideo(videos, '')).toBe(1)
  })

  it('tetap menunjuk embed kalau cuma itu yang ada', () => {
    const videos = [video('Streamtape', 'embed')]
    expect(pickVideo(videos, '720p')).toBe(0)
  })

  it('memakai urutan sumber kalau tidak ada pilihan tersimpan', () => {
    const videos = [video('720p'), video('1080p')]
    expect(pickVideo(videos, '')).toBe(0)
  })

  it('mengembalikan -1 untuk daftar kosong', () => {
    expect(pickVideo([], '720p')).toBe(-1)
  })
})

describe('formatTime', () => {
  it('menyembunyikan jam kalau nol', () => {
    expect(formatTime(754)).toBe('12:34')
    expect(formatTime(9)).toBe('0:09')
  })

  it('menampilkan jam dengan menit dua digit', () => {
    expect(formatTime(3723)).toBe('1:02:03')
  })

  it('aman untuk durasi yang belum diketahui', () => {
    expect(formatTime(Number.NaN)).toBe('0:00')
    expect(formatTime(-5)).toBe('0:00')
  })
})
