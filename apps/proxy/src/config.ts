/**
 * Konfigurasi proxy lewat environment. Nilai bawaannya sengaja aman: allowlist
 * kosong berarti "tolak semua", bukan "izinkan semua" — kalau proxy ini pernah
 * ter-deploy tanpa konfigurasi, dia harus jadi tembok, bukan open relay.
 */

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export interface ProxyConfig {
  host: string
  port: number
  /** Host tujuan yang boleh dihubungi; berasal dari `hosts[]` manifest extension. */
  allowedHosts: string[]
  /** Origin browser yang boleh memanggil proxy. */
  allowedOrigins: string[]
  maxBodyBytes: number
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ProxyConfig {
  const allowedHosts = list(env['PROXY_ALLOWED_HOSTS'])

  return {
    host: env['PROXY_HOST'] ?? '127.0.0.1',
    port: Number(env['PROXY_PORT'] ?? 5181),
    allowedHosts,
    allowedOrigins: list(env['PROXY_ALLOWED_ORIGINS']),
    // Batas untuk `/fetch` saja; `/stream` tidak pernah menahan body di memori.
    maxBodyBytes: Number(env['PROXY_MAX_BODY_BYTES'] ?? 8 * 1024 * 1024),
  }
}
