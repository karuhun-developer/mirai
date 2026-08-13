import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { i18n, setupI18n } from './i18n'
import { setupDb } from './services/db.service'
import './assets/index.css'

/**
 * Urutan boot sengaja eksplisit dan berurutan: database dulu, baru Pinia. Store
 * membaca DB begitu dibuat, jadi DB harus sudah bermigrasi lebih dulu. Kalau
 * gagal, app tidak boleh mount setengah jadi: lebih baik menampilkan panel
 * error mentah daripada layar kosong tanpa penjelasan.
 */
async function bootstrap(): Promise<void> {
  await setupDb()

  const app = createApp(App)

  // i18n dipasang sebelum router: guard dan `meta.title` boleh menerjemahkan.
  setupI18n()
  app.use(i18n)
  app.use(createPinia())
  app.use(router)
  await router.isReady()

  app.mount('#app')
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  const root = document.getElementById('app')
  if (root) {
    root.innerHTML = `
      <div style="padding:24px;font-family:system-ui;color:#e5e7eb;background:#0b0f13;min-height:100vh">
        <h1 style="font-size:18px;margin:0 0 8px">Mirai gagal dijalankan</h1>
        <pre style="white-space:pre-wrap;font-size:13px;color:#f87171">${message}</pre>
      </div>`
  }
  console.error('[mirai] bootstrap gagal', error)
})
