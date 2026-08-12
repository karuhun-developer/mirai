import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import sirv from 'sirv'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string }

/**
 * Menyajikan hasil `pnpm --filter @mirai/extensions build` di `/ext-dev/`.
 *
 * Repo extension yang sesungguhnya adalah URL gh-pages yang dimasukkan user
 * (Fase 2). Selama pengembangan, repo lokal ini menghindari keharusan
 * mem-publish dulu setiap kali mengubah satu selector — dan karena satu origin
 * dengan app, pemuatannya tidak menyentuh proxy sama sekali.
 */
function devExtensionRepo(): Plugin {
  const root = fileURLToPath(new URL('../../extensions/dist', import.meta.url))
  return {
    name: 'mirai-dev-extension-repo',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/ext-dev', sirv(root, { dev: true, etag: true }))
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), devExtensionRepo()],
  define: {
    // Versi dibaca dari package.json waktu build supaya halaman Tentang dan
    // versionName APK tidak pernah berbeda dari rilis yang sebenarnya.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // `host: true` supaya bisa dibuka dari HP di jaringan yang sama waktu
    // menguji layout mobile sebelum ada APK.
    host: true,
    // Port sendiri, dan `strictPort` supaya Vite gagal keras alih-alih diam-diam
    // pindah port — smoke test menembak alamat tetap, bukan menebak.
    port: 5180,
    strictPort: true,
  },
})
