import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.karuhundeveloper.mirai',
  appName: 'Mirai',
  webDir: 'dist',
  android: {
    // Extension pihak ketiga bisa menunjuk ke host yang belum pakai HTTPS.
    // Dibiarkan terbuka di sini; pembatasan sebenarnya ada di allowlist host
    // milik manifest extension, bukan di lapisan WebView.
    allowMixedContent: true,
  },
  plugins: {
    // Mem-patch fetch/XHR di level native supaya request dari extension bebas
    // CORS dan bisa memasang Referer/User-Agent — tanpa ini scraper mati di APK.
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
