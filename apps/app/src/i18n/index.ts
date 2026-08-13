import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import { settings } from '@/services/settings.service'
import { id } from './locales/id'
import { en } from './locales/en'

/**
 * Bahasa antarmuka.
 *
 * Indonesia adalah sumber kebenaran: katalog `id` yang ditulis lebih dulu, dan
 * `en` mengikuti bentuknya lewat `typeof id` — kunci yang lupa diterjemahkan
 * jadi kesalahan kompilasi, bukan teks Indonesia yang menyelinap ke antarmuka
 * berbahasa Inggris.
 *
 * Yang **tidak** diterjemahkan: teks yang datang dari luar aplikasi — nama
 * source, judul chapter, pesan error situs sumber. Itu milik extension dan
 * bahasanya mengikuti situsnya sendiri.
 */

export const LOCALES = [
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'en', label: 'English' },
] as const

export type LocaleCode = (typeof LOCALES)[number]['code']

const DEFAULT_LOCALE: LocaleCode = 'id'

function isSupported(code: string): code is LocaleCode {
  return LOCALES.some((locale) => locale.code === code)
}

/**
 * Setelan yang tersimpan menang; kalau kosong, bahasa perangkat yang dipakai —
 * `navigator.language` boleh berbentuk `en-US`, jadi cukup ruas pertamanya.
 */
function initialLocale(): LocaleCode {
  if (isSupported(settings.locale)) return settings.locale
  const device = (navigator.language || '').split('-')[0] ?? ''
  return isSupported(device) ? device : DEFAULT_LOCALE
}

export const i18n = createI18n({
  // Composition API mode. Wajib `false` di sini: mode legacy memasang `$t` lewat
  // mixin global dan tidak punya tipe yang bisa diperiksa `vue-tsc`.
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { id, en },
})

/**
 * Terjemahan di luar komponen — servis dan store yang menyusun pesan error.
 *
 * `i18n.global.t` reaktif terhadap `locale`, jadi pesan yang **disimpan** di
 * state akan tetap berbahasa lama sampai dihitung ulang. Itu diterima: pesan
 * error selalu lahir dari aksi yang baru saja dijalankan.
 *
 * Tipenya ditulis eksplisit: kalau dibiarkan disimpulkan, tipenya menyebut
 * tipe internal `@intlify/core-base` yang tidak bisa dinamai dari luar paket
 * ini, dan `tsc` menolaknya dengan TS2883.
 */
export const t: typeof i18n.global.t = i18n.global.t

export function setLocale(code: LocaleCode): void {
  settings.locale = code
}

/**
 * Tanggal-waktu dalam bahasa yang sedang dipakai.
 *
 * Dipusatkan karena `toLocaleString('id-ID')` yang ditulis di tiap halaman akan
 * tetap berbahasa Indonesia setelah antarmukanya berpindah ke Inggris. Membaca
 * `locale` di sini juga membuat pemanggilnya ikut dirender ulang saat bahasanya
 * berganti.
 */
export function formatDateTime(value: number): string {
  return new Date(value).toLocaleString(i18n.global.locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Tanggal saja — dipakai daftar chapter, yang jamnya tidak pernah berarti. */
export function formatDate(value: number): string {
  return new Date(value).toLocaleDateString(i18n.global.locale.value)
}

/**
 * Menyalakan perpindahan bahasa tanpa memuat ulang: satu-satunya yang perlu
 * disentuh di luar Vue adalah atribut `lang` di `<html>`, yang dipakai pembaca
 * layar dan aturan pemenggalan kata browser.
 */
export function setupI18n(): void {
  watch(
    () => settings.locale,
    () => {
      const next = initialLocale()
      i18n.global.locale.value = next
      document.documentElement.lang = next
    },
    { immediate: true },
  )
}
