/**
 * Dua loader hls.js: satu untuk menonton dari jaringan lewat proxy
 * (`createProxyLoader`), satu untuk memutar episode yang sudah ada di perangkat
 * (`createLocalLoader`).
 *
 * Loader jaringan yang melewatkan setiap permintaan ke resolver media.
 *
 * Di web, playlist dan segmen HLS tidak bisa diambil langsung: CDN video
 * menolak permintaan lintas-origin dan sering menuntut `Referer` tertentu, dan
 * `XMLHttpRequest` di halaman tidak bisa memasang header itu. Jalan keluarnya
 * proxy — tapi begitu playlist diambil lewat proxy, alamat playlist-nya jadi
 * `…/stream?url=…`, dan setiap URL relatif di dalamnya (`seg-1.ts`) akan
 * diselesaikan terhadap alamat proxy, bukan terhadap alamat aslinya. Hasilnya
 * 404 di segmen pertama.
 *
 * Karena itu loader ini melapor balik ke hls.js dengan **URL asli** sebagai
 * alamat respons, sementara byte-nya diambil dari proxy. hls.js memakai alamat
 * itu sebagai basis, jadi segmen berikutnya datang lagi sebagai URL asli dan
 * dilewatkan proxy sekali lagi — bukan dibungkus proxy dua kali.
 *
 * Bentuknya sengaja tidak menyebut tipe hls.js: dengan begitu ia bisa diuji
 * memakai kelas dasar tiruan, tanpa memuat pemutar sungguhan.
 */

export interface LoaderContextLike {
  url: string
}

export interface LoaderResponseLike {
  url: string
}

export interface LoaderErrorLike {
  code: number
  text: string
}

export interface LoaderCallbacksLike {
  onSuccess: (
    response: LoaderResponseLike,
    stats: unknown,
    context: LoaderContextLike,
    networkDetails: unknown,
  ) => void
  onError?: (
    error: LoaderErrorLike,
    context: LoaderContextLike,
    networkDetails: unknown,
    stats: unknown,
  ) => void
}

export interface LoaderLike {
  load(context: LoaderContextLike, config: unknown, callbacks: LoaderCallbacksLike): void
  abort?(): void
  destroy?(): void
}

export interface LoaderConstructor {
  new (config: unknown): LoaderLike
}

/**
 * @param Base loader bawaan hls.js (`Hls.DefaultConfig.loader`) — dipakai apa
 *   adanya untuk urusan XHR, timeout, dan percobaan ulang.
 * @param resolve pemetaan URL asli → URL yang benar-benar diambil. Di APK ini
 *   fungsi identitas, jadi seluruh berkas ini jadi lapisan kosong.
 */
export function createProxyLoader(
  Base: LoaderConstructor,
  resolve: (url: string) => string,
): LoaderConstructor {
  // Tipe kembaliannya sengaja ditulis sebagai `LoaderConstructor`, bukan
  // dibiarkan disimpulkan: kelas anonim dengan field privat tidak bisa ditulis
  // ke berkas deklarasi (TS4094), dan bagi pemanggil bentuk itu memang cukup.
  return class ProxyLoader extends Base {
    /**
     * hls.js memakai ulang instance loader yang sama saat mencoba ulang, dan
     * `context.url` sudah terlanjur ditulisi alamat proxy. Tanpa ingatan ini,
     * percobaan kedua membungkus alamat proxy dengan proxy lagi.
     */
    #originalUrl: string | null = null

    override load(
      context: LoaderContextLike,
      config: unknown,
      callbacks: LoaderCallbacksLike,
    ): void {
      this.#originalUrl ??= context.url
      const original = this.#originalUrl

      context.url = resolve(original)

      super.load(context, config, {
        ...callbacks,
        onSuccess: (response, stats, ctx, networkDetails) => {
          response.url = original
          ctx.url = original
          callbacks.onSuccess(response, stats, ctx, networkDetails)
        },
      })
    }
  }
}

/**
 * Loader untuk episode yang berkasnya sudah di perangkat.
 *
 * Playlist lokal menunjuk segmennya dengan skema karangan `mirai-local://`
 * (lihat `hlsPlaylist.ts`). Alamat itu tidak bisa diambil XHR, jadi loader ini
 * yang menukarnya jadi alamat berkas sungguhan — `blob:` di web, `capacitor:` di
 * APK — tepat sebelum diambil, lalu **melepasnya lagi begitu segmennya selesai
 * dibaca**. Di situlah bedanya dengan menyiapkan semua alamat di muka: satu
 * episode 24 menit berisi ratusan segmen, dan menahan ratusan berkas terbuka
 * sekaligus cuma untuk memutarnya berurutan adalah cara paling gampang membuat
 * pemutarnya dimatikan sistem karena kehabisan memori.
 *
 * Permintaan yang alamatnya bukan lokal — misalnya playlist `blob:` yang
 * dipasang di awal — diteruskan apa adanya ke loader bawaan.
 *
 * @param open path berkas → alamat siap ambil, atau `null` kalau berkasnya hilang.
 * @param close melepas alamat yang tadi dibuka `open`.
 */
export function createLocalLoader(
  Base: LoaderConstructor,
  open: (path: string) => Promise<string | null>,
  close: (url: string) => void,
): LoaderConstructor {
  const SCHEME = 'mirai-local://'

  return class LocalLoader extends Base {
    /** Alamat berkas yang sedang dipakai; wajib dilepas setelah selesai. */
    #opened: string | null = null
    /**
     * hls.js membatalkan permintaan yang keburu tidak dibutuhkan (pindah
     * kualitas, seek). Tanpa penanda ini, berkas yang alamatnya baru selesai
     * dibuka tetap diambil sesudah pembatalan — dan tidak pernah dilepas.
     */
    #aborted = false

    override load(
      context: LoaderContextLike,
      config: unknown,
      callbacks: LoaderCallbacksLike,
    ): void {
      const original = context.url
      if (!original.startsWith(SCHEME)) {
        super.load(context, config, callbacks)
        return
      }

      const path = original.slice(SCHEME.length)

      void open(path).then((url) => {
        if (this.#aborted) {
          if (url !== null) close(url)
          return
        }

        if (url === null) {
          callbacks.onError?.(
            { code: 404, text: `Berkas ${path} tidak ada di perangkat.` },
            context,
            null,
            {},
          )
          return
        }

        this.#opened = url
        context.url = url

        super.load(context, config, {
          ...callbacks,
          onSuccess: (response, stats, ctx, networkDetails) => {
            // hls.js memakai alamat respons sebagai basis; yang dilaporkan harus
            // alamat lokal, bukan `blob:` yang sebentar lagi dicabut.
            response.url = original
            ctx.url = original
            this.#release()
            callbacks.onSuccess(response, stats, ctx, networkDetails)
          },
          onError: (error, ctx, networkDetails, stats) => {
            this.#release()
            callbacks.onError?.(error, ctx, networkDetails, stats)
          },
        })
      })
    }

    override abort(): void {
      this.#aborted = true
      this.#release()
      super.abort?.()
    }

    override destroy(): void {
      this.#aborted = true
      this.#release()
      super.destroy?.()
    }

    #release(): void {
      if (this.#opened === null) return
      close(this.#opened)
      this.#opened = null
    }
  }
}
