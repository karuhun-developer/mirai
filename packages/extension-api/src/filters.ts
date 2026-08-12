/**
 * Filter pencarian. Host merender daftar ini jadi UI dan mengirim balik daftar
 * yang sama dengan `value` yang sudah terisi — jadi source tidak pernah tahu
 * soal komponen Vue, dan host tidak pernah tahu soal query string source.
 */

export interface FilterBase {
  /** Unik dalam satu `FilterList`. Dipakai host sebagai key render dan penyimpanan. */
  readonly key: string
  readonly name: string
}

/** Judul kelompok; tidak punya nilai. */
export interface HeaderFilter extends FilterBase {
  readonly type: 'header'
}

export interface SeparatorFilter extends FilterBase {
  readonly type: 'separator'
}

export interface TextFilter extends FilterBase {
  readonly type: 'text'
  value: string
  readonly placeholder?: string
}

export interface CheckboxFilter extends FilterBase {
  readonly type: 'checkbox'
  value: boolean
}

/**
 * Tiga keadaan: abaikan, sertakan, kecualikan. Genre biasanya butuh ini —
 * "tanpa Ecchi" beda maksud dari "tidak peduli Ecchi".
 */
export const TriState = {
  Ignore: 0,
  Include: 1,
  Exclude: 2,
} as const

export type TriStateValue = (typeof TriState)[keyof typeof TriState]

export interface TriStateFilter extends FilterBase {
  readonly type: 'tristate'
  value: TriStateValue
}

export interface FilterOption {
  readonly label: string
  /** Nilai mentah yang dikirim ke source; boleh beda dari label. */
  readonly value: string
}

export interface SelectFilter extends FilterBase {
  readonly type: 'select'
  readonly options: readonly FilterOption[]
  /** Indeks ke `options`. */
  value: number
}

export interface SortValue {
  index: number
  ascending: boolean
}

export interface SortFilter extends FilterBase {
  readonly type: 'sort'
  readonly options: readonly FilterOption[]
  value: SortValue
}

export interface GroupFilter extends FilterBase {
  readonly type: 'group'
  readonly filters: Filter[]
}

export type Filter =
  | HeaderFilter
  | SeparatorFilter
  | TextFilter
  | CheckboxFilter
  | TriStateFilter
  | SelectFilter
  | SortFilter
  | GroupFilter

export type FilterList = Filter[]
