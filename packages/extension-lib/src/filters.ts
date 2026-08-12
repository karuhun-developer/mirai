import type {
  CheckboxFilter,
  Filter,
  FilterList,
  FilterOption,
  GroupFilter,
  HeaderFilter,
  SelectFilter,
  SeparatorFilter,
  SortFilter,
  TextFilter,
  TriStateFilter,
  TriStateValue,
} from '@mirai/extension-api'
import { TriState } from '@mirai/extension-api'

/** Pembentuk filter. Mengurangi salah ketik `type` dan lupa nilai awal. */

export function header(key: string, name: string): HeaderFilter {
  return { type: 'header', key, name }
}

export function separator(key: string): SeparatorFilter {
  return { type: 'separator', key, name: '' }
}

export function textFilter(key: string, name: string, placeholder?: string): TextFilter {
  return placeholder === undefined
    ? { type: 'text', key, name, value: '' }
    : { type: 'text', key, name, value: '', placeholder }
}

export function checkbox(key: string, name: string, value = false): CheckboxFilter {
  return { type: 'checkbox', key, name, value }
}

export function triState(
  key: string,
  name: string,
  value: TriStateValue = TriState.Ignore,
): TriStateFilter {
  return { type: 'tristate', key, name, value }
}

export function select(
  key: string,
  name: string,
  options: readonly FilterOption[],
  value = 0,
): SelectFilter {
  return { type: 'select', key, name, options, value }
}

export function sort(
  key: string,
  name: string,
  options: readonly FilterOption[],
  index = 0,
  ascending = false,
): SortFilter {
  return { type: 'sort', key, name, options, value: { index, ascending } }
}

export function group(key: string, name: string, filters: Filter[]): GroupFilter {
  return { type: 'group', key, name, filters }
}

/** Opsi dengan label = value, untuk daftar yang tidak butuh terjemahan. */
export function options(...values: string[]): FilterOption[] {
  return values.map((value) => ({ label: value, value }))
}

/**
 * Mencari filter berdasarkan key, termasuk di dalam group. Mengembalikan
 * `undefined` kalau tidak ada — filter tersimpan dari versi extension lama
 * boleh hilang tanpa membuat pencarian gagal.
 */
export function findFilter(filters: FilterList, key: string): Filter | undefined {
  for (const filter of filters) {
    if (filter.key === key) return filter
    if (filter.type === 'group') {
      const nested = findFilter(filter.filters, key)
      if (nested) return nested
    }
  }
  return undefined
}

export function selectedOption(filters: FilterList, key: string): FilterOption | undefined {
  const filter = findFilter(filters, key)
  if (filter?.type !== 'select') return undefined
  return filter.options[filter.value]
}

export function textValue(filters: FilterList, key: string): string {
  const filter = findFilter(filters, key)
  return filter?.type === 'text' ? filter.value.trim() : ''
}

export function checkboxValue(filters: FilterList, key: string): boolean {
  const filter = findFilter(filters, key)
  return filter?.type === 'checkbox' ? filter.value : false
}

/** Memisahkan anggota group tri-state jadi daftar disertakan dan dikecualikan. */
export function triStatePartition(
  filters: FilterList,
  groupKey: string,
): { included: string[]; excluded: string[] } {
  const found = findFilter(filters, groupKey)
  const included: string[] = []
  const excluded: string[] = []
  if (found?.type !== 'group') return { included, excluded }

  for (const child of found.filters) {
    if (child.type !== 'tristate') continue
    if (child.value === TriState.Include) included.push(child.key)
    else if (child.value === TriState.Exclude) excluded.push(child.key)
  }
  return { included, excluded }
}
