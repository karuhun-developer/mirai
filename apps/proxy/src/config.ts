/** Konfigurasi proxy lewat environment. */

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export interface ProxyConfig {
  host: string
  port: number
  /**
   * Pembatas host tujuan, **opsional**. Kosong = host publik mana pun boleh,
   * dan itu nilai bawaannya.
   *
   * Dulu ini allowlist wajib yang gagal-tertutup, diisi tangan dari `hosts[]`
   * manifest. Itu tidak pernah bisa benar: sumber dipasang pengguna saat app
   * jalan, sedangkan daftar ini dibaca sekali saat proxy start — extension apa
   * pun yang dipasang setelahnya pasti kena 403. Yang benar-benar menjaga mesin
   * tempat proxy berjalan adalah gerbang alamat internal di `guard.ts`, dan itu
   * tidak bisa dimatikan. Isi daftar ini hanya kalau proxy dipasang untuk
   * dipakai bersama-sama.
   */
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
