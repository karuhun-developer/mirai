import cors from '@fastify/cors'
import Fastify from 'fastify'
import { loadConfig } from './config.ts'
import { registerRoutes } from './routes.ts'

const config = loadConfig()

const app = Fastify({
  logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  // Video besar butuh waktu; batas bawaan Fastify memutus stream di tengah.
  requestTimeout: 0,
})

await app.register(cors, {
  origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : true,
  methods: ['GET', 'POST', 'OPTIONS'],
  // Pemutar mengirim Range dan membaca Content-Range; tanpa expose, hls.js buta.
  exposedHeaders: ['content-range', 'accept-ranges', 'content-length'],
})

registerRoutes(app, config)

// Terikat ke loopback, proxy ini cuma bisa dipakai orang yang sudah duduk di
// mesin ini. Begitu di-bind ke alamat lain, dia jadi layanan yang bisa dipanggil
// siapa saja dari jaringan — di situ pembatas host baru masuk akal.
if (config.allowedHosts.length === 0 && !/^(127\.|::1$|localhost$)/.test(config.host)) {
  app.log.warn(
    `Proxy mendengarkan di ${config.host} tanpa PROXY_ALLOWED_HOSTS — siapa pun di jaringan ini bisa memakainya untuk mengambil URL publik mana pun.`,
  )
}

await app.listen({ host: config.host, port: config.port })
