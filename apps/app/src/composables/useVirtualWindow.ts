import { computed, nextTick, onMounted, onScopeDispose, ref, watch, type Ref } from 'vue'
import { rowRange } from './virtualRange'

export interface VirtualWindowOptions {
  /** Tinggi satu baris sebelum ada baris asli yang bisa diukur. */
  estimate: number
  /**
   * Di bawah jumlah ini semuanya dirender apa adanya. Daftar pendek tidak
   * memberi keuntungan apa pun dari windowing, sementara harganya nyata:
   * pencarian bawaan browser (Ctrl+F) tidak menemukan baris yang tidak ada di
   * DOM, dan itu tidak sepadan untuk dua puluh judul.
   */
  threshold?: number
  overscan?: number
}

export interface VirtualWindow {
  /** Indeks item pertama yang dirender. */
  from: Ref<number>
  /** Satu lewat indeks item terakhir yang dirender. */
  to: Ref<number>
  /** Gaya padding untuk elemen daftarnya; menjaga tinggi & posisi scrollbar. */
  spacer: Ref<{ paddingTop: string; paddingBottom: string }>
  /** Sedang memotong daftar, atau merender semuanya. */
  active: Ref<boolean>
}

/**
 * Merender hanya baris yang terlihat dari sebuah daftar atau grid panjang.
 *
 * Library dengan ribuan judul dan daftar chapter judul lama (One Piece lewat
 * 1.100 chapter) menghasilkan puluhan ribu node DOM sekaligus — tiap kartu
 * punya `<img>` yang menahan blob cover, tiap baris chapter punya empat tombol.
 * Yang pertama menghabiskan memori, yang kedua membuat setiap perubahan kecil
 * (satu chapter ditandai selesai) memicu patch atas seluruh daftar.
 *
 * Elemen daftarnya sendiri yang diberi padding, bukan disisipi elemen kosong:
 * anak langsung sebuah CSS grid ikut menempati kolom, jadi spacer berupa `div`
 * akan bergeser jadi kartu kosong di tengah grid.
 *
 * Yang menggulung dianggap jendela browser — seluruh halaman di Mirai memang
 * digulung oleh dokumen, bukan oleh kotak ber-`overflow` sendiri.
 */
export function useVirtualWindow(
  el: Ref<HTMLElement | null>,
  count: () => number,
  options: VirtualWindowOptions,
): VirtualWindow {
  const { estimate, threshold = 60, overscan = 3 } = options

  const columns = ref(1)
  const rowHeight = ref(estimate)
  const scrolled = ref(0)
  const viewport = ref(0)

  const active = computed(() => count() > threshold)

  const range = computed(() => {
    if (!active.value) return null
    return rowRange({
      rows: Math.ceil(count() / columns.value),
      rowHeight: rowHeight.value,
      scrolled: scrolled.value,
      viewport: viewport.value,
      overscan,
    })
  })

  const from = computed(() => (range.value ? range.value.start * columns.value : 0))
  const to = computed(() =>
    range.value ? Math.min(count(), range.value.end * columns.value) : count(),
  )
  const spacer = computed(() => ({
    paddingTop: range.value ? `${range.value.padTop}px` : '0px',
    paddingBottom: range.value ? `${range.value.padBottom}px` : '0px',
  }))

  /** Jarak daftar terhadap layar; dibaca ulang tiap gulungan, bukan disimpan. */
  function position(): void {
    const node = el.value
    if (!node) return
    scrolled.value = -node.getBoundingClientRect().top
    viewport.value = window.innerHeight
  }

  /**
   * Ukuran baris diambil dari baris yang sungguh dirender, bukan dihitung dari
   * rasio kartu: judul dua baris, badge, dan pembulatan grid membuat tebakan
   * meleset beberapa piksel, dan melesetnya menumpuk sepanjang ribuan baris
   * sampai scrollbar berbohong.
   */
  function measure(): void {
    const node = el.value
    if (!node) return
    const style = getComputedStyle(node)

    if (style.display.includes('grid')) {
      // Track hasil `repeat(auto-fill, …)` sudah diselesaikan browser jadi
      // daftar piksel, jadi jumlah kolomnya tinggal dihitung.
      const tracks = style.gridTemplateColumns.split(' ').filter(Boolean)
      columns.value = Math.max(1, tracks.length)
    }

    const child = node.firstElementChild
    if (!child) return
    const gap = Number.parseFloat(style.rowGap)
    const height = child.getBoundingClientRect().height + (Number.isFinite(gap) ? gap : 0)
    if (height > 0) rowHeight.value = height
  }

  let queued = false
  function onScroll(): void {
    // Gulungan menembak jauh lebih sering daripada layar digambar ulang;
    // membaca posisi di tiap kejadian berarti memaksa layout berkali-kali per
    // frame.
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      position()
    })
  }

  let observer: ResizeObserver | null = null

  onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
  })

  /**
   * Elemennya diamati lewat `watch`, bukan sekali di `onMounted`.
   *
   * Daftar dan grid duduk di balik `v-if` yang menunggu datanya dimuat, jadi
   * saat komponennya di-mount elemennya belum ada. Mengukur sekali di situ
   * berarti tinggi layar tercatat nol selamanya, dan yang dirender cuma
   * beberapa baris pertama sampai orangnya menggulung.
   */
  watch(
    el,
    (node) => {
      observer?.disconnect()
      observer = null
      if (!node) return
      observer = new ResizeObserver(() => {
        measure()
        position()
      })
      observer.observe(node)
      position()
      measure()
    },
    { immediate: true, flush: 'post' },
  )

  // Isi daftar berganti (pindah kategori, filter, urutan dibalik) tanpa
  // komponennya di-mount ulang: tinggi barisnya bisa berbeda, dan posisinya
  // pasti berbeda.
  watch(
    () => [count(), active.value],
    () => void nextTick(measure),
  )

  onScopeDispose(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
    observer?.disconnect()
  })

  return { from, to, spacer, active }
}
