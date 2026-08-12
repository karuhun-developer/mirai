/**
 * Loader hls.js yang melewatkan setiap permintaan ke resolver media.
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

export interface LoaderCallbacksLike {
  onSuccess: (
    response: LoaderResponseLike,
    stats: unknown,
    context: LoaderContextLike,
    networkDetails: unknown,
  ) => void
}

export interface LoaderLike {
  load(context: LoaderContextLike, config: unknown, callbacks: LoaderCallbacksLike): void
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
