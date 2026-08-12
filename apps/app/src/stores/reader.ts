import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RemoteMangaSource, RemoteSource } from '@mirai/extension-runtime'
import type { EntryRow, ItemRow } from '@mirai/db'
import {
  defaultReaderPrefs,
  loadContext,
  loadPages,
  markFinished,
  readReaderPrefs,
  reloadItem,
  saveProgress,
  writeReaderPrefs,
  type ReaderPage,
  type ReaderPrefs,
} from '@/services/reader.service'
import { challengeOf, type ChallengeInfo } from '@/services/challenge.service'

/**
 * Keadaan satu sesi baca.
 *
 * Yang dijaga di sini tepat dua hal yang mudah salah: **posisi baca tidak boleh
 * hilang** walau app ditutup mendadak, dan **chapter tidak boleh ditandai
 * selesai kalau halamannya belum pernah sampai**. Sisanya (mode, zoom, menu)
 * cuma tampilan.
 */
export const useReaderStore = defineStore('reader', () => {
  const entry = ref<EntryRow | null>(null)
  const item = ref<ItemRow | null>(null)
  const pages = ref<ReaderPage[]>([])
  const previous = ref<ItemRow | null>(null)
  const next = ref<ItemRow | null>(null)
  const position = ref(0)
  const totalItems = ref(0)

  const index = ref(0)
  const prefs = ref<ReaderPrefs>({ ...defaultReaderPrefs })

  const loading = ref(false)
  const error = ref<string | null>(null)
  const challenge = ref<ChallengeInfo | null>(null)

  const total = computed(() => pages.value.length)
  const hasPages = computed(() => pages.value.length > 0)
  /** Halaman ke berapa untuk manusia: 1-based, dan tidak pernah 0 dari total 0. */
  const humanPage = computed(() => (hasPages.value ? index.value + 1 : 0))
  const atStart = computed(() => index.value <= 0)
  const atEnd = computed(() => index.value >= pages.value.length - 1)

  /** Urutan tampil halaman; RTL cuma membalik arah, bukan isi daftarnya. */
  const rightToLeft = computed(() => prefs.value.mode === 'rtl')
  const webtoon = computed(() => prefs.value.mode === 'webtoon')

  /**
   * Membuka chapter. Konteksnya dari database dulu supaya judul dan nomor
   * langsung tampil; daftar halaman menyusul dari source.
   *
   * Sumbernya dicari lewat `resolve`, bukan diserahkan pemanggil: id sumber baru
   * diketahui setelah entri terbaca dari database. Memungutnya dari potongan
   * `itemId` di halaman pemanggil memang bisa, tapi itu menyebarkan bentuk id
   * ke luar `packages/db` — dan bentuk itu sengaja jadi urusan satu tempat.
   */
  async function open(
    itemId: string,
    resolve: (sourceId: string) => RemoteSource | undefined,
  ): Promise<void> {
    loading.value = true
    error.value = null
    challenge.value = null
    pages.value = []
    index.value = 0

    try {
      prefs.value = await readReaderPrefs()

      const context = await loadContext(itemId)
      if (!context) throw new Error('Chapter ini tidak ada di database.')

      entry.value = context.entry
      item.value = context.item
      previous.value = context.previous ?? null
      next.value = context.next ?? null
      position.value = context.position
      totalItems.value = context.total

      const source = resolve(context.entry.source_id)
      if (!source) {
        throw new Error(
          'Extension sumber chapter ini tidak terpasang atau sedang dimatikan, jadi halamannya tidak bisa diambil.',
        )
      }
      if (source.kind !== 'manga') throw new Error('Sumber ini bukan sumber manga.')

      pages.value = await loadPages(source as RemoteMangaSource, context.item)
      if (pages.value.length === 0) throw new Error('Sumber tidak mengembalikan satu halaman pun.')

      // Lanjut di tempat terakhir — kecuali chapternya sudah tamat, yang mulai
      // dari awal lagi. Membuka ulang chapter yang sudah selesai hampir selalu
      // berarti ingin membacanya ulang, bukan melihat halaman terakhirnya.
      const saved = context.item.seen === 1 ? 0 : context.item.last_position
      index.value = Math.min(Math.max(saved, 0), pages.value.length - 1)
    } catch (cause) {
      const blocked = challengeOf(cause)
      if (blocked) challenge.value = blocked
      else error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  /**
   * Pindah halaman. Progres ditulis di sini, bukan di komponen: mode paged dan
   * webtoon sama-sama lewat jalan ini, dan aturan "halaman terakhir = selesai"
   * cuma boleh hidup di satu tempat.
   */
  async function goTo(value: number): Promise<void> {
    const current = item.value
    if (!current || pages.value.length === 0) return

    const clamped = Math.min(Math.max(value, 0), pages.value.length - 1)
    if (clamped === index.value) return
    index.value = clamped

    if (clamped >= pages.value.length - 1) await finish()
    else await saveProgress(current, clamped, pages.value.length)
  }

  async function forward(): Promise<void> {
    await goTo(index.value + 1)
  }

  async function backward(): Promise<void> {
    await goTo(index.value - 1)
  }

  /**
   * Menandai chapter selesai. Dipanggil begitu halaman terakhir terlihat —
   * termasuk oleh mode webtoon lewat pengamat gulir — dan aman dipanggil
   * berkali-kali.
   */
  async function finish(): Promise<void> {
    const current = item.value
    if (!current || pages.value.length === 0) return
    await markFinished(current, pages.value.length)
    item.value = (await reloadItem(current.id)) ?? current
  }

  async function setPrefs(patch: Partial<ReaderPrefs>): Promise<void> {
    prefs.value = { ...prefs.value, ...patch }
    await writeReaderPrefs(prefs.value)
  }

  /** Menutup reader: memastikan posisi terakhir sudah tersimpan. */
  async function close(): Promise<void> {
    const current = item.value
    if (current && pages.value.length > 0 && index.value < pages.value.length - 1) {
      await saveProgress(current, index.value, pages.value.length)
    }
  }

  return {
    entry,
    item,
    pages,
    previous,
    next,
    position,
    totalItems,
    index,
    prefs,
    loading,
    error,
    challenge,
    total,
    hasPages,
    humanPage,
    atStart,
    atEnd,
    rightToLeft,
    webtoon,
    open,
    goTo,
    forward,
    backward,
    finish,
    setPrefs,
    close,
  }
})
