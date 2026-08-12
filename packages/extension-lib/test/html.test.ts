import { describe, expect, it } from 'vitest'
import { absoluteUrl, attrOf, imageSrc, parseHtml, selectAll, text, textOf } from '../src/html.js'

const FIXTURE = `
  <div class="list">
    <article class="item">
      <a href="/manga/satu"><img data-lazy-src="https://cdn.test/1.jpg" src="data:image/gif;base64,R0lGOD" /></a>
      <h3>   Judul   Satu
      </h3>
    </article>
    <article class="item">
      <a href="https://lain.test/manga/dua"><img src="https://cdn.test/2.jpg" /></a>
      <h3>Judul Dua</h3>
    </article>
  </div>
`

describe('helper HTML', () => {
  const doc = parseHtml(FIXTURE)

  it('memilih banyak elemen sebagai array biasa', () => {
    expect(selectAll(doc, '.item')).toHaveLength(2)
  })

  it('merapikan whitespace teks', () => {
    const first = selectAll(doc, '.item')[0]!
    expect(textOf(first, 'h3')).toBe('Judul Satu')
  })

  it('mengembalikan string kosong, bukan null, untuk elemen yang tidak ada', () => {
    expect(text(doc.querySelector('.tidak-ada'))).toBe('')
    expect(attrOf(doc, '.tidak-ada', 'href')).toBe('')
  })

  it('melewati placeholder data: dan mengambil URL dari atribut lazy-load', () => {
    const first = selectAll(doc, '.item')[0]!
    expect(imageSrc(first.querySelector('img'))).toBe('https://cdn.test/1.jpg')
  })

  it('meresolusi href relatif dan membiarkan yang sudah absolut', () => {
    expect(absoluteUrl('https://situs.test', '/manga/satu')).toBe('https://situs.test/manga/satu')
    expect(absoluteUrl('https://situs.test', 'https://lain.test/x')).toBe('https://lain.test/x')
  })

  it('mengembalikan href apa adanya kalau base tidak valid, bukan melempar', () => {
    expect(absoluteUrl('bukan-url', '/manga/satu')).toBe('/manga/satu')
  })
})
