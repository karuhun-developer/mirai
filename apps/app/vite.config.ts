import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string }

export default defineConfig({
  plugins: [vue(), tailwindcss()],
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
