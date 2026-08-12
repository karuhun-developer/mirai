/**
 * Penyempit JSON.
 *
 * Respons API pihak ketiga masuk sebagai `unknown` — itu disengaja, karena
 * bentuknya tidak bisa dijamin saat kompilasi. Helper di sini membuat
 * mempersempitnya murah, supaya penulis extension tidak tergoda memakai cast
 * dan menunda kegagalan sampai jauh di dalam parser.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Menelusuri jalur bersarang; berhenti diam-diam begitu ada yang tidak cocok. */
export function get(value: unknown, ...path: (string | number)[]): unknown {
  let current = value
  for (const key of path) {
    if (typeof key === 'number') {
      if (!Array.isArray(current)) return undefined
      current = current[key]
    } else {
      if (!isRecord(current)) return undefined
      current = current[key]
    }
  }
  return current
}

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Daftar string, membuang anggota yang bukan string alih-alih ikut gagal. */
export function strList(value: unknown): string[] {
  return arr(value).filter((item): item is string => typeof item === 'string')
}
