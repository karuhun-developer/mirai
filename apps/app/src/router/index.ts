import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

/**
 * Semua halaman di-lazy load. Reader dan player membawa dependensi berat
 * (hls.js, dekoder gambar) yang tidak boleh ikut ke bundel awal — app harus
 * tetap cepat dibuka di HP kelas menengah.
 *
 * `meta.fullscreen` dibaca AppShell untuk menyembunyikan nav.
 */
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/library/anime' },

  {
    path: '/library/:kind(anime|manga)',
    name: 'library',
    component: () => import('@/pages/library/LibraryPage.vue'),
  },
  {
    path: '/updates',
    name: 'updates',
    component: () => import('@/pages/updates/UpdatesPage.vue'),
  },
  {
    path: '/browse',
    name: 'browse',
    component: () => import('@/pages/browse/BrowsePage.vue'),
  },
  {
    path: '/browse/:sourceId',
    name: 'browse-source',
    component: () => import('@/pages/browse/SourceBrowsePage.vue'),
  },
  {
    path: '/more',
    name: 'more',
    component: () => import('@/pages/more/MorePage.vue'),
  },
  {
    path: '/downloads',
    name: 'downloads',
    component: () => import('@/pages/downloads/DownloadsPage.vue'),
  },
  {
    path: '/extensions',
    name: 'extensions',
    component: () => import('@/pages/extensions/ExtensionsPage.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/pages/settings/SettingsPage.vue'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/pages/about/AboutPage.vue'),
  },

  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    // Kembali dari detail ke grid harus mendarat di posisi scroll semula —
    // kalau tidak, menelusuri katalog panjang jadi menyiksa.
    return savedPosition ?? { top: 0 }
  },
})
