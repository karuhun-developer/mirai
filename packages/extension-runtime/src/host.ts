import type {
  AnimeSource,
  EntriesPage,
  FilterList,
  HttpClient,
  MangaSource,
  SAnime,
  SChapter,
  SEntry,
  SEpisode,
  SManga,
  SPage,
  SVideo,
} from '@mirai/extension-api'
import { API_VERSION } from '@mirai/extension-api'
import type {
  HostMessage,
  PreferenceSnapshot,
  SourceInfo,
  SourceMethod,
  WorkerMessage,
} from './protocol.js'
import { SourceCallError, serializeError } from './protocol.js'

export interface LoadOptions {
  /** Kode extension yang sudah dibundel jadi satu berkas ESM. */
  code: string
  /** Nilai setelan tiap source di paket ini, dikirim sekali saat init. */
  prefs?: PreferenceSnapshot
  /** `apiVersion` dari manifest; dicocokkan sebelum kode dijalankan. */
  apiVersion?: number
  /** Batas waktu satu panggilan metode source, milidetik. */
  callTimeout?: number
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout> | undefined
}

/**
 * Satu instance = satu paket extension = satu Worker.
 *
 * Worker sengaja tidak dibagi antar-extension: extension yang crash atau
 * menggantung tidak boleh menyeret yang lain, dan mematikannya harus semudah
 * `terminate()`.
 */
export class ExtensionInstance {
  private worker: Worker | undefined
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  private infos: SourceInfo[] = []

  constructor(
    private readonly http: HttpClient,
    private readonly callTimeout = 30_000,
  ) {}

  get sources(): readonly SourceInfo[] {
    return this.infos
  }

  async load(options: LoadOptions): Promise<readonly SourceInfo[]> {
    const declared = options.apiVersion ?? API_VERSION
    if (declared !== API_VERSION) {
      throw new Error(
        `Extension menargetkan apiVersion ${declared}, aplikasi ini menyediakan ${API_VERSION}. ` +
          'Update extension-nya, atau update Mirai.',
      )
    }

    this.terminate()
    // Worker modul: kode extension memakai sintaks ESM dan `import()` dinamis.
    this.worker = new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => this.onMessage(event.data)
    this.worker.onerror = (event) =>
      this.failAll(new Error(`Worker extension mati: ${event.message}`))

    const result = await this.send({
      kind: 'init',
      id: this.nextId++,
      code: options.code,
      apiVersion: declared,
      prefs: options.prefs ?? {},
    })

    this.infos = result as SourceInfo[]
    return this.infos
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = undefined
    this.failAll(new Error('Extension dihentikan'))
    this.infos = []
  }

  /** Memanggil satu metode source di dalam worker. */
  call(sourceId: string, method: SourceMethod, args: unknown[] = []): Promise<unknown> {
    return this.send({ kind: 'call', id: this.nextId++, sourceId, method, args }).catch(
      (error: unknown) => {
        throw error instanceof SourceCallError
          ? error
          : new SourceCallError(sourceId, method, serializeError(error))
      },
    )
  }

  private send(message: Extract<HostMessage, { kind: 'init' | 'call' }>): Promise<unknown> {
    const worker = this.worker
    if (!worker) return Promise.reject(new Error('Extension belum dimuat'))

    return new Promise<unknown>((resolve, reject) => {
      // Extension yang menggantung tidak boleh membekukan UI selamanya; timeout
      // di sisi host adalah satu-satunya jaminan, karena worker-nya kode asing.
      const timer = setTimeout(() => {
        this.pending.delete(message.id)
        reject(new Error(`Extension tidak menjawab dalam ${this.callTimeout / 1000} detik`))
      }, this.callTimeout)

      this.pending.set(message.id, { resolve, reject, timer })
      worker.postMessage(message)
    })
  }

  private settle(id: number): Pending | undefined {
    const pending = this.pending.get(id)
    if (!pending) return undefined
    this.pending.delete(id)
    if (pending.timer !== undefined) clearTimeout(pending.timer)
    return pending
  }

  private onMessage(message: WorkerMessage): void {
    if (message.kind === 'http') {
      void this.serveHttp(message.id, message.req)
      return
    }

    const pending = this.settle(message.id)
    if (!pending) return

    if (message.kind === 'ready') pending.resolve(message.sources)
    else if (message.kind === 'ok') pending.resolve(message.value)
    else pending.reject(new SourceCallError('extension', 'call', message.error))
  }

  private async serveHttp(id: number, req: Parameters<HttpClient['request']>[0]): Promise<void> {
    const worker = this.worker
    if (!worker) return

    try {
      const res = await this.http.request(req)
      worker.postMessage({ kind: 'http:ok', id, res } satisfies HostMessage)
    } catch (error) {
      worker.postMessage({
        kind: 'http:fail',
        id,
        error: serializeError(error),
      } satisfies HostMessage)
    }
  }

  private failAll(error: Error): void {
    for (const id of [...this.pending.keys()]) this.settle(id)?.reject(error)
  }
}

/**
 * Pembungkus tipis yang membuat memanggil source di dalam worker terasa seperti
 * memanggil objeknya langsung — halaman tidak perlu tahu soal RPC.
 */
class RemoteCatalogue<T extends SEntry> {
  constructor(
    protected readonly instance: ExtensionInstance,
    readonly info: SourceInfo,
  ) {}

  get id(): string {
    return this.info.id
  }

  get name(): string {
    return this.info.name
  }

  getPopular(page: number): Promise<EntriesPage<T>> {
    return this.instance.call(this.info.id, 'getPopular', [page]) as Promise<EntriesPage<T>>
  }

  getLatest(page: number): Promise<EntriesPage<T>> {
    return this.instance.call(this.info.id, 'getLatest', [page]) as Promise<EntriesPage<T>>
  }

  getSearch(page: number, query: string, filters: FilterList = []): Promise<EntriesPage<T>> {
    return this.instance.call(this.info.id, 'getSearch', [page, query, filters]) as Promise<
      EntriesPage<T>
    >
  }

  getDetails(entry: T): Promise<T> {
    return this.instance.call(this.info.id, 'getDetails', [entry]) as Promise<T>
  }

  getFilterList(): Promise<FilterList> {
    return this.instance.call(this.info.id, 'getFilterList') as Promise<FilterList>
  }
}

export class RemoteMangaSource
  extends RemoteCatalogue<SManga>
  implements Pick<MangaSource, 'kind'>
{
  readonly kind = 'manga' as const

  getChapterList(manga: SManga): Promise<SChapter[]> {
    return this.instance.call(this.info.id, 'getChapterList', [manga]) as Promise<SChapter[]>
  }

  getPageList(chapter: SChapter): Promise<SPage[]> {
    return this.instance.call(this.info.id, 'getPageList', [chapter]) as Promise<SPage[]>
  }
}

export class RemoteAnimeSource
  extends RemoteCatalogue<SAnime>
  implements Pick<AnimeSource, 'kind'>
{
  readonly kind = 'anime' as const

  getEpisodeList(anime: SAnime): Promise<SEpisode[]> {
    return this.instance.call(this.info.id, 'getEpisodeList', [anime]) as Promise<SEpisode[]>
  }

  getVideoList(episode: SEpisode): Promise<SVideo[]> {
    return this.instance.call(this.info.id, 'getVideoList', [episode]) as Promise<SVideo[]>
  }
}

export type RemoteSource = RemoteMangaSource | RemoteAnimeSource

export function bindSources(instance: ExtensionInstance): RemoteSource[] {
  return instance.sources.map((info) =>
    info.kind === 'manga'
      ? new RemoteMangaSource(instance, info)
      : new RemoteAnimeSource(instance, info),
  )
}
