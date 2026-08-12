/// <reference types="vite/client" />

/** Diisi oleh `define` di vite.config.ts dari `version` milik package.json. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Basis URL proxy CORS untuk build web. Kosong di native — di sana pakai CapacitorHttp. */
  readonly VITE_PROXY_URL?: string
  /**
   * Basis URL repo extension. Selama pengembangan menunjuk `/ext-dev` yang
   * disajikan Vite dari `extensions/dist`; mulai Fase 2 daftarnya dikelola user.
   */
  readonly VITE_EXT_REPO_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
