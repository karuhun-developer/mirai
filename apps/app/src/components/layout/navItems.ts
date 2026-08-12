import type { FunctionalComponent } from 'vue'
import { Clapperboard, BookOpen, RefreshCw, Compass, Ellipsis, type LucideProps } from '@lucide/vue'

export interface NavItem {
  /** Nama route tujuan — bukan path, supaya perubahan URL tidak menyentuh nav. */
  to: string
  label: string
  icon: FunctionalComponent<LucideProps>
  /**
   * Prefix path yang membuat item ini dianggap aktif. Perlu karena satu item nav
   * menaungi beberapa route (mis. Browse aktif juga di `/browse/:sourceId`).
   */
  match: string
}

/**
 * Satu-satunya sumber daftar navigasi. BottomNav (mobile) dan SideRail (desktop)
 * dua-duanya membaca dari sini supaya tidak pernah beda isi.
 */
export const navItems: NavItem[] = [
  { to: '/library/anime', label: 'Anime', icon: Clapperboard, match: '/library/anime' },
  { to: '/library/manga', label: 'Manga', icon: BookOpen, match: '/library/manga' },
  { to: '/updates', label: 'Updates', icon: RefreshCw, match: '/updates' },
  { to: '/browse', label: 'Browse', icon: Compass, match: '/browse' },
  { to: '/more', label: 'Lainnya', icon: Ellipsis, match: '/more' },
]

export function isNavActive(currentPath: string, item: NavItem): boolean {
  return currentPath === item.match || currentPath.startsWith(`${item.match}/`)
}
