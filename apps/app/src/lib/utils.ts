import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Gabungkan class Tailwind dengan aman: `clsx` menangani kondisional, `twMerge`
 * membuang konflik (mis. `p-2` dari varian vs `p-4` dari pemanggil — yang menang
 * yang terakhir). Dipakai di semua komponen ui/.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
