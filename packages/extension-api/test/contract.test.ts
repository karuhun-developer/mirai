import { describe, expect, it } from 'vitest'
import {
  API_VERSION,
  HttpError,
  TriState,
  isAnimeSource,
  isConfigurable,
  isMangaSource,
  type AnimeSource,
  type AnySource,
  type MangaSource,
} from '../src/index.js'

/**
 * Kontrak ini yang dipegang extension pihak ketiga. Test-nya sengaja menjaga
 * nilai-nilai literal: menaikkan `API_VERSION` atau menggeser angka `TriState`
 * mematikan semua extension yang sudah terpasang, jadi perubahannya harus
 * disengaja — bukan efek samping refactor.
 */

const manga = {
  id: 'dummy',
  name: 'Dummy',
  lang: 'id',
  baseUrl: 'https://dummy.test',
  supportsLatest: true,
  isNsfw: false,
  kind: 'manga',
} as unknown as MangaSource

const anime = { ...manga, kind: 'anime' } as unknown as AnimeSource

describe('kontrak extension-api', () => {
  it('mengunci versi API di angka yang dicek runtime', () => {
    expect(API_VERSION).toBe(1)
  })

  it('memisahkan manga dan anime lewat diskriminan kind', () => {
    const sources: AnySource[] = [manga, anime]

    expect(sources.filter(isMangaSource)).toEqual([manga])
    expect(sources.filter(isAnimeSource)).toEqual([anime])
  })

  it('menganggap source configurable hanya kalau getPreferences benar-benar ada', () => {
    expect(isConfigurable(manga)).toBe(false)
    expect(isConfigurable({ ...manga, getPreferences: () => [] })).toBe(true)
    // Properti bernama sama tapi bukan fungsi tidak boleh lolos.
    expect(isConfigurable({ ...manga, getPreferences: true })).toBe(false)
  })

  it('mempertahankan angka TriState yang tersimpan di preferensi user', () => {
    expect(TriState).toEqual({ Ignore: 0, Include: 1, Exclude: 2 })
  })

  it('membawa status dan URL di HttpError supaya host bisa membedakan 404 dari mati total', () => {
    const error = new HttpError(404, 'https://dummy.test/x')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('HttpError')
    expect(error.status).toBe(404)
    expect(error.url).toBe('https://dummy.test/x')
    // Pesan default harus menyebut status dan URL: itu yang muncul di toast.
    expect(error.message).toContain('404')
    expect(error.message).toContain('https://dummy.test/x')
  })
})
