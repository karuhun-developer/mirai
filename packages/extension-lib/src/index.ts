/**
 * @mirai/extension-lib — perkakas penulis extension.
 *
 * Boleh gemuk: paket ini ikut dibundel ke tiap berkas extension oleh esbuild,
 * bukan ke aplikasi. Kontraknya sendiri ada di @mirai/extension-api.
 */

export { absoluteUrl, attr, attrOf, imageSrc, parseHtml, selectAll, text, textOf } from './html.js'
export type { MDocument, MElement } from './html.js'

export {
  checkbox,
  checkboxValue,
  findFilter,
  group,
  header,
  options,
  select,
  selectedOption,
  separator,
  sort,
  textFilter,
  textValue,
  triState,
  triStatePartition,
} from './filters.js'

export { ParsedAnimeSource, ParsedHttpSource, ParsedMangaSource } from './http-source.js'

export { arr, bool, get, isRecord, num, str, strList } from './json.js'

export {
  compact,
  DEFAULT_USER_AGENT,
  mapLimit,
  parseIsoDate,
  parseNumber,
  query,
  refererHeaders,
} from './util.js'
