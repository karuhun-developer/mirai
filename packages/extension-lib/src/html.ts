import { parseHTML } from 'linkedom'

/**
 * Antarmuka DOM minimal yang benar-benar dipakai penulis extension.
 *
 * Sengaja tidak memakai tipe `Element` bawaan lib.dom maupun tipe internal
 * linkedom: extension dikompilasi tanpa lib DOM (worker, bukan halaman), dan
 * mematok tipe internal pustaka pihak ketiga berarti mengganti pustaka itu
 * jadi perubahan yang merusak kontrak.
 */
export interface MElement {
  querySelector(selector: string): MElement | null
  querySelectorAll(selector: string): Iterable<MElement>
  getAttribute(name: string): string | null
  readonly textContent: string | null
  readonly innerHTML: string
}

export type MDocument = MElement

/**
 * Worker tidak punya `DOMParser`, jadi parsing HTML memakai linkedom yang ikut
 * dibundel ke tiap extension.
 */
export function parseHtml(html: string): MDocument {
  const { document } = parseHTML(html)
  // linkedom memang menyediakan seluruh anggota MElement; cast di satu titik
  // batas ini menahan tipe internalnya supaya tidak bocor ke penulis extension.
  return document as unknown as MDocument
}

/** `querySelectorAll` sebagai array biasa, supaya bisa langsung di-`map`. */
export function selectAll(root: MElement, selector: string): MElement[] {
  return [...root.querySelectorAll(selector)]
}

/** Teks yang sudah dirapikan; `null` jadi string kosong agar pemanggil tidak perlu menjaga. */
export function text(el: MElement | null | undefined): string {
  return el?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

export function textOf(root: MElement, selector: string): string {
  return text(root.querySelector(selector))
}

export function attr(el: MElement | null | undefined, name: string): string {
  return el?.getAttribute(name)?.trim() ?? ''
}

export function attrOf(root: MElement, selector: string, name: string): string {
  return attr(root.querySelector(selector), name)
}

/**
 * Lazy-load bikin `src` berisi placeholder; URL aslinya ada di salah satu atribut
 * data-*. Dicoba berurutan sampai ketemu yang terisi.
 */
export function imageSrc(el: MElement | null | undefined, ...extra: string[]): string {
  const candidates = [...extra, 'data-src', 'data-lazy-src', 'data-original', 'src']
  for (const name of candidates) {
    const value = attr(el, name)
    if (value && !value.startsWith('data:')) return value
  }
  return ''
}

/** Meresolusi href relatif terhadap base. Href yang sudah absolut dibiarkan. */
export function absoluteUrl(base: string, href: string): string {
  if (!href) return ''
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}
