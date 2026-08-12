import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

/**
 * Membundel tiap extension jadi satu berkas ESM mandiri.
 *
 * `@mirai/extension-lib` sengaja ikut dibundel (bukan di-external): berkas
 * hasilnya dijalankan di Worker lewat blob URL, yang tidak punya resolver modul
 * — apa pun yang tersisa sebagai `import` di situ akan gagal saat dimuat.
 *
 * Katalog repo lengkap (ikon, gh-pages, versi per source) menyusul di Fase 2;
 * di sini cukup bundel + index minimal supaya app bisa memuat MangaDex.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')
const outDir = join(root, 'dist')

interface Manifest {
  pkg: string
  name: string
  lang: string
  version: string
  apiVersion: number
  nsfw: boolean
  hosts: string[]
}

async function findExtensions(): Promise<{ dir: string; manifest: Manifest }[]> {
  const found: { dir: string; manifest: Manifest }[] = []

  for (const lang of await readdir(srcDir, { withFileTypes: true })) {
    if (!lang.isDirectory()) continue
    const langDir = join(srcDir, lang.name)

    for (const slug of await readdir(langDir, { withFileTypes: true })) {
      if (!slug.isDirectory()) continue
      const dir = join(langDir, slug.name)
      const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as Manifest
      found.push({ dir, manifest })
    }
  }

  return found
}

const extensions = await findExtensions()
if (extensions.length === 0) throw new Error('Tidak ada extension di extensions/src')

await rm(outDir, { recursive: true, force: true })
await mkdir(join(outDir, 'js'), { recursive: true })

for (const { dir, manifest } of extensions) {
  await build({
    entryPoints: [join(dir, 'index.ts')],
    outfile: join(outDir, 'js', `${manifest.pkg}.js`),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    // Sourcemap dilepas ke berkas terpisah supaya stack trace dari worker masih
    // bisa dibaca tanpa menggemukkan bundel yang diunduh pengguna.
    sourcemap: 'linked',
    legalComments: 'none',
  })
  console.log(`✓ ${manifest.pkg} (${manifest.lang}) v${manifest.version}`)
}

const index = extensions.map(({ manifest }) => ({
  ...manifest,
  file: `js/${manifest.pkg}.js`,
}))

await writeFile(join(outDir, 'index.min.json'), JSON.stringify(index), 'utf8')
console.log(`\n${extensions.length} extension → extensions/dist`)
