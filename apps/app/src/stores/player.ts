import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RemoteAnimeSource, RemoteSource } from '@mirai/extension-runtime'
import type { EntryRow, ItemRow } from '@mirai/db'
import {
  defaultPlayerPrefs,
  loadSubtitle,
  markWatched,
  readPlayerPrefs,
  releaseVideos,
  resolveVideos,
  saveProgress,
  writePlayerPrefs,
  type PlayerPrefs,
} from '@/services/player.service'
import { isFinished, pickVideo, resumeAt, type PlayableVideo } from '@/services/playback'
import { loadItemContext, reloadItem } from '@/services/item.service'
import { challengeOf, type ChallengeInfo } from '@/services/challenge.service'
import { t } from '@/i18n'

/**
 * Keadaan satu sesi tonton.
 *
 * Dua hal yang dijaga ketat di sini: **posisi tonton tidak boleh hilang** walau
 * app ditutup mendadak, dan **berganti kualitas tidak boleh mengulang dari
 * awal**. Yang kedua itulah alasan `resumeTo` ada — elemen `<video>` selalu
 * mulai dari nol tiap kali sumbernya diganti, jadi detik terakhir harus dititip
 * di store dan dipasang lagi setelah metadata sumber baru siap.
 */

/** Takarir yang sudah (atau belum) diambil; `src` diisi saat pertama dipilih. */
export interface PlayerTrack {
  url: string
  label: string
  lang?: string
  src: string | null
}

/** Sesering apa posisi tonton ditulis ke database, dalam detik pemutaran. */
const SAVE_EVERY = 5

export const usePlayerStore = defineStore('player', () => {
  const entry = ref<EntryRow | null>(null)
  const item = ref<ItemRow | null>(null)
  const previous = ref<ItemRow | null>(null)
  const next = ref<ItemRow | null>(null)
  const position = ref(0)
  const totalItems = ref(0)

  const videos = ref<PlayableVideo[]>([])
  const videoIndex = ref(-1)
  /** Diputar dari berkas di perangkat; UI menampilkannya, `release()` memakainya. */
  const offline = ref(false)
  const tracks = ref<PlayerTrack[]>([])
  const trackIndex = ref(-1)

  const prefs = ref<PlayerPrefs>({ ...defaultPlayerPrefs })

  const currentTime = ref(0)
  const duration = ref(0)
  const playing = ref(false)
  const buffering = ref(false)
  /** Detik yang harus dipasang begitu sumber berikutnya siap; -1 berarti tidak ada. */
  const resumeTo = ref(-1)

  const loading = ref(false)
  const error = ref<string | null>(null)
  const challenge = ref<ChallengeInfo | null>(null)

  /** Posisi tersimpan terakhir, dipakai supaya database tidak ditulisi tiap detik. */
  let savedAt = 0
  /** Tanda "sudah ditulis selesai" — ambangnya bisa terlewati berkali-kali. */
  let finished = false

  const current = computed<PlayableVideo | null>(() => videos.value[videoIndex.value] ?? null)
  const hasVideo = computed(() => current.value !== null)
  /** Tipe `embed` cuma halaman player pihak ketiga; tidak ada yang bisa diputar. */
  const isEmbed = computed(() => current.value?.type === 'embed')
  const activeTrack = computed<PlayerTrack | null>(() => tracks.value[trackIndex.value] ?? null)

  /**
   * Membuka episode. Sama polanya dengan reader: konteks dari database dulu
   * supaya judul dan nomor langsung tampil, daftar video menyusul dari source.
   */
  async function open(
    itemId: string,
    resolve: (sourceId: string) => RemoteSource | undefined,
  ): Promise<void> {
    loading.value = true
    error.value = null
    challenge.value = null
    release()
    videoIndex.value = -1
    resetTracks()
    currentTime.value = 0
    duration.value = 0
    resumeTo.value = -1
    savedAt = 0
    finished = false

    try {
      prefs.value = await readPlayerPrefs()

      const context = await loadItemContext(itemId)
      if (!context) throw new Error(t('errors.episodeMissing'))

      entry.value = context.entry
      item.value = context.item
      previous.value = context.previous ?? null
      next.value = context.next ?? null
      position.value = context.position
      totalItems.value = context.total

      // Sumbernya boleh tidak ada: episode yang sudah diunduh diputar tanpa
      // extension sama sekali. Yang memutuskan itu `resolveVideos`, satu-satunya
      // tempat yang tahu berkas lokalnya benar-benar ada atau tidak.
      const source = resolve(context.entry.source_id)
      if (source && source.kind !== 'anime') throw new Error(t('errors.sourceNotAnime'))

      const resolved = await resolveVideos(
        context.entry,
        context.item,
        source as RemoteAnimeSource | undefined,
      )
      videos.value = resolved.videos
      offline.value = resolved.local
      if (videos.value.length === 0) throw new Error(t('errors.noVideos'))

      videoIndex.value = pickVideo(videos.value, prefs.value.quality)
      await useTracksOfCurrent()

      // Durasi belum diketahui sebelum metadata terbaca, jadi ambang "selesai"
      // dihitung ulang di `report()`. Yang penting di sini: episode yang sudah
      // ditonton mulai dari nol lagi.
      resumeTo.value = resumeAt(context.item, context.item.total_position ?? 0)
    } catch (cause) {
      const blocked = challengeOf(cause)
      if (blocked) challenge.value = blocked
      else error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  /**
   * Berpindah kualitas/host. Posisi sekarang dititipkan ke `resumeTo` supaya
   * pemutar melompat balik ke sana setelah sumber baru siap — inilah janji
   * "pindah kualitas tidak mengulang dari awal".
   */
  async function selectVideo(index: number): Promise<void> {
    const target = videos.value[index]
    if (!target || index === videoIndex.value) return

    resumeTo.value = currentTime.value
    videoIndex.value = index
    await useTracksOfCurrent()

    // Label yang dipilih manual jadi pilihan berikutnya, termasuk untuk episode
    // lain: orang yang menurunkan kualitas demi kuota tidak mau mengulanginya
    // tiap episode. Kecuali label episode terunduh — "Terunduh" bukan kualitas,
    // dan menyimpannya berarti unduhan berikutnya kehilangan acuan.
    if (target.type !== 'embed' && !target.local) await setPrefs({ quality: target.quality })
  }

  /** Memilih takarir; `-1` mematikannya. Berkasnya baru diambil saat dipilih. */
  async function selectTrack(index: number): Promise<void> {
    if (index < 0) {
      trackIndex.value = -1
      return
    }

    const track = tracks.value[index]
    if (!track) return

    if (track.src === null) {
      try {
        track.src = await loadSubtitle(track)
      } catch (cause) {
        // Takarir gagal bukan alasan menghentikan tontonan; cukup diberitahukan.
        error.value = `Takarir "${track.label}" gagal dimuat: ${
          cause instanceof Error ? cause.message : String(cause)
        }`
        return
      }
    }

    trackIndex.value = index
  }

  /**
   * Laporan posisi dari elemen video. Dipanggil tiap `timeupdate` — sekitar
   * empat kali sedetik — jadi penulisan ke database dijarangkan sendiri di sini.
   */
  async function report(seconds: number, total: number): Promise<void> {
    currentTime.value = seconds
    if (Number.isFinite(total) && total > 0) duration.value = total

    const row = item.value
    if (!row) return

    if (!finished && isFinished(seconds, duration.value)) {
      finished = true
      await finish()
      return
    }

    if (Math.abs(seconds - savedAt) < SAVE_EVERY) return
    savedAt = seconds
    await saveProgress(row, seconds, duration.value)
  }

  /** Menandai episode selesai. Aman dipanggil berkali-kali. */
  async function finish(): Promise<void> {
    const row = item.value
    if (!row) return
    finished = true
    await markWatched(row, currentTime.value, duration.value)
    item.value = (await reloadItem(row.id)) ?? row
  }

  async function setPrefs(patch: Partial<PlayerPrefs>): Promise<void> {
    prefs.value = { ...prefs.value, ...patch }
    await writePlayerPrefs(prefs.value)
  }

  /**
   * Menutup pemutar: berkas yang terbuka dilepas, posisi terakhir disimpan.
   *
   * Urutannya bukan selera. Halaman memanggilnya dari `onBeforeUnmount` tanpa
   * menunggu, jadi apa pun yang ditulis **setelah** `await` di sini mendarat
   * waktu episode berikutnya sudah selesai memuat — dan mengosongkan daftar
   * videonya. Karena itu seluruh keadaan dibereskan lebih dulu secara sinkron,
   * dan yang ditunggu cuma tulisan ke database yang tidak menyentuh store.
   */
  async function close(): Promise<void> {
    const row = item.value
    const seconds = currentTime.value
    const total = duration.value
    const saved = finished

    resetTracks()
    release()
    playing.value = false
    buffering.value = false

    if (row && !saved && seconds > 0) await saveProgress(row, seconds, total)
  }

  /** Melepas berkas lokal yang sedang dibuka; aman dipanggil berkali-kali. */
  function release(): void {
    releaseVideos(videos.value)
    videos.value = []
    offline.value = false
  }

  /** Daftar takarir mengikuti video yang aktif; tiap host punya berkasnya sendiri. */
  async function useTracksOfCurrent(): Promise<void> {
    resetTracks()
    tracks.value = (current.value?.subtitles ?? []).map((track) => ({ ...track, src: null }))

    if (prefs.value.subtitles && tracks.value.length > 0) await selectTrack(0)
  }

  /**
   * Blob takarir harus dilepas manual. Tanpa ini, satu maraton dua belas episode
   * meninggalkan dua belas berkas menggantung di memori sampai tab ditutup.
   */
  function resetTracks(): void {
    for (const track of tracks.value) {
      if (track.src !== null) URL.revokeObjectURL(track.src)
    }
    tracks.value = []
    trackIndex.value = -1
  }

  return {
    entry,
    item,
    previous,
    next,
    position,
    totalItems,
    videos,
    videoIndex,
    offline,
    tracks,
    trackIndex,
    prefs,
    currentTime,
    duration,
    playing,
    buffering,
    resumeTo,
    loading,
    error,
    challenge,
    current,
    hasVideo,
    isEmbed,
    activeTrack,
    open,
    selectVideo,
    selectTrack,
    report,
    finish,
    setPrefs,
    close,
  }
})
