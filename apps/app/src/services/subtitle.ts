/**
 * Konversi teks takarir ke WebVTT.
 *
 * `<track>` di browser cuma mengerti WebVTT, sedangkan sumber anime membagikan
 * SRT (paling umum) dan ASS/SSA (fansub, karena bisa mengatur posisi dan gaya).
 * Tanpa konversi, dua dari tiga takarir yang tersedia jadi tidak bisa dipakai
 * sama sekali — dan takarir adalah alasan utama banyak orang menonton di sini,
 * bukan pelengkap.
 *
 * Yang dikonversi cuma teks dan waktunya. Gaya ASS (posisi, warna, karaoke)
 * sengaja dibuang: menampilkannya butuh renderer sendiri di atas kanvas, dan
 * takarir tanpa gaya jauh lebih baik daripada tidak ada takarir.
 */

/** Berkas yang sudah WebVTT dibiarkan apa adanya; sisanya dikenali dari isinya. */
export function toVtt(text: string): string {
  // BOM ditulis sebagai escape, bukan karakternya: berkas takarir kerap datang
  // dengan BOM, dan `WEBVTT` di belakangnya jadi tidak terkenali kalau dibiarkan.
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (source.trimStart().startsWith('WEBVTT')) return source
  if (/^\[Script Info\]|^\[V4\+? Styles\]|^Dialogue:/m.test(source)) return assToVtt(source)
  return srtToVtt(source)
}

/**
 * SRT ke VTT: bedanya cuma header dan koma pemisah milidetik. Nomor urut cue
 * dibiarkan — WebVTT membolehkannya sebagai pengenal cue.
 */
function srtToVtt(source: string): string {
  const body = source.replace(
    /(\d{1,2}:\d{2}:\d{2}),(\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g,
    (_match, start: string, startMs: string, end: string, endMs: string) =>
      `${pad2(start)}.${padMs(startMs)} --> ${pad2(end)}.${padMs(endMs)}`,
  )
  return `WEBVTT\n\n${body.trim()}\n`
}

/**
 * ASS/SSA ke VTT.
 *
 * Urutan kolom `Dialogue:` tidak tetap antar berkas — itulah gunanya baris
 * `Format:` di atasnya. Membaca posisi kolom dari `Format:` (bukan menganggap
 * Start selalu kolom kedua) adalah beda antara takarir yang tepat waktu dan
 * takarir yang muncul acak.
 */
function assToVtt(source: string): string {
  const lines = source.split('\n')
  let columns: string[] = []
  const cues: string[] = []

  for (const line of lines) {
    const format = /^Format:\s*(.+)$/.exec(line)
    if (format?.[1]) {
      columns = format[1].split(',').map((name) => name.trim().toLowerCase())
      continue
    }

    const dialogue = /^Dialogue:\s*(.+)$/.exec(line)
    if (!dialogue?.[1]) continue

    const start = columns.indexOf('start')
    const end = columns.indexOf('end')
    const textAt = columns.indexOf('text')
    if (start < 0 || end < 0 || textAt < 0) continue

    // Kolom terakhir (`Text`) boleh mengandung koma, jadi pemisahannya dibatasi
    // sebanyak kolom yang dideklarasikan — sisanya milik teks.
    const parts = dialogue[1].split(',')
    const head = parts.slice(0, textAt)
    const text = parts.slice(textAt).join(',')

    const from = assTime(head[start])
    const to = assTime(head[end])
    if (!from || !to) continue

    const clean = cleanAssText(text)
    if (!clean) continue

    cues.push(`${from} --> ${to}\n${clean}`)
  }

  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}

/** `0:01:02.34` (sentidetik) → `00:01:02.340`. */
function assTime(value: string | undefined): string | undefined {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})$/.exec((value ?? '').trim())
  if (!match) return undefined
  const [, hour = '0', minute = '00', second = '00', fraction = '0'] = match
  return `${hour.padStart(2, '0')}:${minute}:${second}.${fraction.padEnd(3, '0')}`
}

function cleanAssText(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '') // tag override: {\an8}, {\i1}, karaoke
    .replace(/\\[Nnh]/g, '\n') // pemisah baris ASS
    .trim()
}

function pad2(time: string): string {
  return time.length === 7 ? `0${time}` : time
}

function padMs(value: string): string {
  return value.padEnd(3, '0').slice(0, 3)
}
