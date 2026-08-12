/**
 * @mirai/extension-api — kontrak murni antara host dan extension.
 *
 * Paket ini TIDAK BOLEH punya dependensi runtime, selamanya. Itu yang membuat
 * versinya stabil dan extension lama tidak pecah waktu toolkit berubah.
 * Toolkit-nya ada di @mirai/extension-lib.
 */

export { API_VERSION } from './context.js'
export type { SourceContext, SourceFactory } from './context.js'

export { HttpError } from './http.js'
export type { HttpClient, HttpHeaders, HttpMethod, HttpRequest, HttpResponse } from './http.js'

export type {
  EntriesPage,
  SAnime,
  SChapter,
  SEntry,
  SEpisode,
  SManga,
  SPage,
  SStatus,
  STrack,
  SVideo,
  SVideoType,
} from './models.js'

export { TriState } from './filters.js'
export type {
  CheckboxFilter,
  Filter,
  FilterList,
  FilterOption,
  GroupFilter,
  HeaderFilter,
  SelectFilter,
  SeparatorFilter,
  SortFilter,
  SortValue,
  TextFilter,
  TriStateFilter,
  TriStateValue,
} from './filters.js'

export type {
  ListPreference,
  MultiSelectPreference,
  PreferenceStore,
  SourcePreference,
  SwitchPreference,
  TextPreference,
} from './preferences.js'

export { isAnimeSource, isConfigurable, isMangaSource } from './source.js'
export type {
  AnimeSource,
  AnySource,
  CatalogueSource,
  ConfigurableSource,
  MangaSource,
  Source,
} from './source.js'
