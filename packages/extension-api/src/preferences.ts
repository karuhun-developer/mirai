/**
 * Setelan per source (domain alternatif, bahasa terjemahan, kualitas default).
 * Deklaratif, bukan komponen — host yang merendernya di halaman Extension.
 */

export interface PreferenceBase {
  readonly key: string
  readonly title: string
  readonly summary?: string
}

export interface TextPreference extends PreferenceBase {
  readonly type: 'text'
  readonly default: string
  readonly placeholder?: string
}

export interface SwitchPreference extends PreferenceBase {
  readonly type: 'switch'
  readonly default: boolean
}

export interface ListPreference extends PreferenceBase {
  readonly type: 'list'
  readonly entries: readonly string[]
  /** Sejajar dengan `entries`; ini yang benar-benar disimpan. */
  readonly values: readonly string[]
  readonly default: string
}

export interface MultiSelectPreference extends PreferenceBase {
  readonly type: 'multiselect'
  readonly entries: readonly string[]
  readonly values: readonly string[]
  readonly default: readonly string[]
}

export type SourcePreference =
  TextPreference | SwitchPreference | ListPreference | MultiSelectPreference

/**
 * Pembacaan setelan sengaja sinkron: source memanggilnya di dalam pembentukan
 * request, dan await di setiap pembacaan cuma menambah titik gagal. Host sudah
 * memuat seluruh setelan sebelum worker dijalankan.
 */
export interface PreferenceStore {
  getString(key: string, fallback: string): string
  getBoolean(key: string, fallback: boolean): boolean
  getStringList(key: string, fallback: readonly string[]): string[]
}
