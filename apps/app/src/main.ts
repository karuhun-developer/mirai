import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './assets/index.css'

/**
 * Urutan boot sengaja eksplisit dan berurutan. Mulai Fase 3 di sini akan ada
 * `initDb()` sebelum Pinia — store membaca DB saat dibuat, jadi DB harus sudah
 * siap lebih dulu. Kalau gagal, app tidak boleh mount setengah jadi: lebih baik
 * menampilkan panel error mentah daripada layar kosong tanpa penjelasan.
 */
async function bootstrap(): Promise<void> {
  const app = createApp(App)

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
