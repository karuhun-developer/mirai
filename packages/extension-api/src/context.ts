import type { HttpClient } from './http.js'
import type { PreferenceStore } from './preferences.js'
import type { AnySource } from './source.js'

/**
 * Versi kontrak. Naik setiap kali ada perubahan yang merusak extension lama.
 * Runtime menolak extension dengan `apiVersion` berbeda dan menyebut kedua
 * angkanya di pesan error, supaya jelas mana yang harus di-update.
 */
export const API_VERSION = 1

/** Satu-satunya jalan extension menyentuh dunia luar. */
export interface SourceContext {
  readonly apiVersion: number
  readonly http: HttpClient
  readonly preferences: PreferenceStore
}

/**
 * Entry point setiap extension: `export default` sebuah fungsi bertipe ini.
 * Satu paket boleh mengembalikan banyak source — pola lazim untuk source yang
 * sama dengan bahasa berbeda.
 */
export type SourceFactory = (ctx: SourceContext) => AnySource[]
