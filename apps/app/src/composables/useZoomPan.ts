import { computed, onScopeDispose, ref, type ComputedRef, type CSSProperties, type Ref } from 'vue'

/**
 * Zoom, geser, dan pembacaan gestur untuk satu halaman manga.
 *
 * Dikerjakan sendiri, bukan menyerahkannya ke zoom bawaan browser: zoom halaman
 * ikut memperbesar bilah menu reader dan tidak bisa dikembalikan ke 1× waktu
 * halaman berganti. Yang di sini terbatas pada elemen gambarnya saja.
 *
 * Semuanya lewat Pointer Events, jadi jari, stylus, dan mouse memakai jalan yang
 * sama — `touchstart`/`mousedown` terpisah selalu berakhir jadi dua cabang yang
 * perlahan berbeda perilaku.
 */

const MIN_SCALE = 1
const MAX_SCALE = 4
/** Perbesaran satu ketukan ganda. Cukup untuk teks kecil, belum kabur. */
const DOUBLE_TAP_SCALE = 2.5
/** Jeda maksimum antara dua ketukan supaya dianggap ketukan ganda. */
const DOUBLE_TAP_MS = 280
/** Jarak minimum sebuah usapan mendatar sebelum dihitung sebagai ganti halaman. */
const SWIPE_PX = 60
/** Geseran sekecil ini masih dianggap ketukan, bukan usapan. */
const TAP_SLOP_PX = 8

export interface ZoomPanOptions {
  /**
   * Ketukan tunggal, beserta posisi mendatarnya dalam rasio 0–1 dari lebar
   * elemen. Baru dipanggil setelah jendela ketukan ganda lewat — kalau tidak,
   * ketukan pertama sebuah ketukan-ganda terlanjur mengganti halaman.
   */
  onTap?: (ratio: number) => void
  /** Usapan mendatar saat tidak sedang diperbesar. */
  onSwipe?: (direction: 'left' | 'right') => void
}

export interface ZoomPan {
  scale: Ref<number>
  zoomed: ComputedRef<boolean>
  style: ComputedRef<CSSProperties>
  reset: () => void
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

export function useZoomPan(options: ZoomPanOptions = {}): ZoomPan {
  const scale = ref(1)
  const x = ref(0)
  const y = ref(0)
  const active = ref(0)

  const pointers = new Map<number, { x: number; y: number }>()
  let startDistance = 0
  let startScale = 1
  let from: { x: number; y: number; ox: number; oy: number } | null = null
  let moved = false
  let pendingTap: ReturnType<typeof setTimeout> | null = null

  const zoomed = computed(() => scale.value > 1.001)

  const style = computed<CSSProperties>(() => ({
    transform: `translate3d(${x.value}px, ${y.value}px, 0) scale(${scale.value})`,
    // Transisi hanya saat tidak ada jari di layar; kalau tidak, gerakannya
    // terasa tertinggal sepersekian detik dari jarinya.
    transition: active.value > 0 ? 'none' : 'transform 150ms ease-out',
    transformOrigin: 'center center',
    // Saat diperbesar, gulir halaman harus mengalah pada geseran gambar.
    touchAction: zoomed.value ? 'none' : 'pan-y',
  }))

  function reset(): void {
    scale.value = 1
    x.value = 0
    y.value = 0
  }

  function distance(): number {
    const [a, b] = [...pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  function cancelPendingTap(): boolean {
    if (pendingTap === null) return false
    clearTimeout(pendingTap)
    pendingTap = null
    return true
  }

  function onPointerDown(event: PointerEvent): void {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    active.value = pointers.size
    moved = false

    if (pointers.size === 2) {
      startDistance = distance()
      startScale = scale.value
      from = null
      return
    }

    from = { x: event.clientX, y: event.clientY, ox: x.value, oy: y.value }
  }

  function onPointerMove(event: PointerEvent): void {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.size === 2 && startDistance > 0) {
      scale.value = Math.min(
        Math.max((distance() / startDistance) * startScale, MIN_SCALE),
        MAX_SCALE,
      )
      if (!zoomed.value) reset()
      moved = true
      return
    }

    if (!from || pointers.size !== 1) return

    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    if (Math.hypot(dx, dy) > TAP_SLOP_PX) moved = true

    // Geseran hanya menggerakkan gambar kalau memang sedang diperbesar; kalau
    // tidak, gerakan mendatar itu milik navigasi halaman.
    if (zoomed.value) {
      x.value = from.ox + dx
      y.value = from.oy + dy
    }
  }

  function onPointerUp(event: PointerEvent): void {
    const start = from
    pointers.delete(event.pointerId)
    active.value = pointers.size
    if (pointers.size < 2) startDistance = 0
    if (pointers.size === 0) from = null
    if (pointers.size > 0) return

    if (moved) {
      if (!zoomed.value && start) {
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
          options.onSwipe?.(dx < 0 ? 'left' : 'right')
        }
      }
      return
    }

    // Ketukan kedua yang datang sebelum ketukan pertama sempat dijalankan:
    // itulah ketukan ganda, dan yang pertama dibatalkan.
    if (cancelPendingTap()) {
      if (zoomed.value) reset()
      else scale.value = DOUBLE_TAP_SCALE
      return
    }

    const target = event.currentTarget
    const box = target instanceof HTMLElement ? target.getBoundingClientRect() : null
    // Tanpa kotak elemen, posisi ketukan tidak bisa dihitung — 0.5 berarti
    // "tengah", yaitu perlakuan paling aman: membuka menu, bukan ganti halaman.
    const value = box && box.width > 0 ? clamp01((event.clientX - box.left) / box.width) : 0.5

    pendingTap = setTimeout(() => {
      pendingTap = null
      options.onTap?.(value)
    }, DOUBLE_TAP_MS)
  }

  onScopeDispose(cancelPendingTap)

  return { scale, zoomed, style, reset, onPointerDown, onPointerMove, onPointerUp }
}
