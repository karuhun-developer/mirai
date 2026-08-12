import type { RouteLocationRaw } from 'vue-router'
import type { EntryKind } from '@mirai/db'

/**
 * Tujuan rute yang dipakai lebih dari satu halaman.
 *
 * `url` entri berisi garis miring dan tanda tanya, jadi rutenya memakai
 * parameter `(.*)`. Yang penting: alamatnya selalu disusun lewat objek rute
 * seperti di sini, bukan digabung sebagai string — vue-router yang mengurus
 * penyandiannya, dan `%2F` yang ditulis tangan akan tersandi dua kali.
 */
export function entryLocation(kind: EntryKind, sourceId: string, url: string): RouteLocationRaw {
  return { name: 'entry', params: { kind, sourceId, url } }
}
