/**
 * Katalog Bahasa Indonesia — sumber kebenaran.
 *
 * Kuncinya dikelompokkan mengikuti folder yang memakainya (`nav`, `library`,
 * `reader`, …) supaya string yang mati ikut ketahuan waktu halamannya dihapus.
 * Yang dipakai lebih dari satu halaman tinggal di `common`.
 */
export const id = {
  common: {
    search: 'Cari',
    filter: 'Filter',
    refresh: 'Muat ulang',
    retry: 'Coba lagi',
    cancel: 'Batal',
    save: 'Simpan',
    close: 'Tutup',
    remove: 'Hapus',
    back: 'Kembali',
    mainNav: 'Navigasi utama',
    anime: 'Anime',
    manga: 'Manga',
    loading: 'Memuat…',
  },

  nav: {
    anime: 'Anime',
    manga: 'Manga',
    updates: 'Updates',
    browse: 'Browse',
    more: 'Lainnya',
    downloads: 'Unduhan',
    extensions: 'Extension',
    settings: 'Pengaturan',
    history: 'Riwayat',
    about: 'Tentang',
    home: 'Mirai — beranda',
  },

  more: {
    title: 'Lainnya',
    history: 'Yang terakhir dibaca & ditonton',
    downloads: 'Antrean & isi offline',
    extensions: 'Repo & sumber',
    settings: 'Tampilan & penyimpanan',
    about: 'Versi & lisensi',
  },

  about: {
    title: 'Tentang',
    version: 'Versi {version}',
    intro:
      'Mirai adalah pembaca manga dan pemutar anime yang tidak membawa sumber konten apa pun. Seluruh katalog berasal dari extension yang kamu pasang sendiri.',
    responsibility:
      'Kamu bertanggung jawab atas repo extension yang kamu tambahkan dan atas kepatuhan pada ketentuan layanan situs sumbernya.',
  },

  notFound: {
    title: 'Halaman tidak ditemukan',
    description: 'Tautannya mungkin sudah berubah atau salah ketik.',
    back: 'Kembali ke Library',
  },

  cloudflare: {
    title: '{source} meminta verifikasi Cloudflare',
    body: 'Situsnya hidup, tapi menahan Mirai dengan pemeriksaan "verify you are human". Mirai tidak memutari pemeriksaan itu — kamu yang menyelesaikannya sendiri, lalu kembali ke sini dan muat ulang.',
    webWarningStrong: 'Di versi web ini tidak akan berhasil.',
    webWarning:
      'Permintaan dikirim lewat proxy dari mesin lain, sedangkan izin hasil verifikasi menempel pada browser dan alamat IP yang menyelesaikannya. Pakai APK-nya, atau pilih sumber lain.',
    solve: 'Selesaikan verifikasi',
    openSite: 'Buka situsnya',
    changeUserAgent: 'Ubah User-Agent',
    stillBlocked:
      'Kalau setelah diselesaikan pun masih tertahan, sumber itu memang sedang tidak bisa dipakai.',
  },

  library: {
    searchPlaceholder: 'Cari di library…',
    searchLabel: 'Cari di library',
    categories: 'Kategori',
    refreshing: 'Menyegarkan {done}/{total} — {title}',
    emptyTitle: 'Library {kind} masih kosong',
    emptyDescription:
      'Pasang extension lalu tandai judul sebagai favorit — isinya akan tetap ada walau kamu sedang offline.',
    browse: 'Jelajahi sumber',
    noMatchTitle: 'Tidak ada yang cocok',
    noMatchDescription: 'Coba ubah kata kunci, kategori, atau saringan yang sedang aktif.',
    allCategories: 'Semua',
    uncategorized: 'Tanpa kategori',

    filters: {
      sort: 'Urutkan',
      sortTitle: 'Judul',
      sortAdded: 'Ditambahkan',
      sortLastRead: 'Terakhir dibaca',
      sortUnread: 'Belum dibaca',
      filter: 'Saring',
      unreadOnly: 'Ada yang belum dibaca',
      downloadedOnly: 'Sudah diunduh',
      categories: 'Kategori',
      dropCategory: 'Hapus kategori {name}',
      newCategory: 'Kategori baru…',
      newCategoryLabel: 'Nama kategori baru',
      addCategory: 'Tambah kategori',
      dropHint: 'Menghapus kategori tidak menghapus judul di dalamnya.',
    },
  },

  updates: {
    title: 'Updates',
    progress: '{done}/{total} — {title}',
    report: '{checked} judul diperiksa, {added} item baru.',
    skipped: '{count} dilewati (extension tidak terpasang).',
    failed: '{count} gagal.',
    markRead: 'Tandai sudah dibaca',
    markUnread: 'Tandai belum dibaca',
    emptyTitle: 'Belum ada update',
    emptyDescription:
      'Chapter dan episode baru dari judul di library kamu akan muncul di sini setelah disegarkan.',
    refreshNow: 'Segarkan sekarang',
  },

  history: {
    title: 'Riwayat',
    clear: 'Hapus semua riwayat',
    remove: 'Hapus dari riwayat',
    emptyTitle: 'Riwayat masih kosong',
    emptyDescription:
      'Chapter dan episode yang sudah kamu baca atau tonton akan tercatat di sini — seluruhnya tersimpan lokal.',
  },

  browse: {
    title: 'Browse',
    loading: 'Memuat extension…',
    emptyTitle: 'Belum ada sumber aktif',
    emptyDescription:
      'Mirai tidak membawa sumber bawaan. Tambahkan repo extension dulu, lalu pasang sumber yang kamu mau.',
    openExtensions: 'Buka Extension',
    searchPlaceholder: 'Cari judul…',
    popular: 'Populer',
    latest: 'Terbaru',
    sourceFallback: 'Sumber',
    thisSource: 'Sumber ini',
    notFoundTitle: 'Sumber tidak ditemukan',
    notFoundDescription: 'Extension untuk {id} tidak terpasang.',
    noResults: 'Tidak ada hasil.',
    loadMore: 'Muat lebih banyak',
  },

  entry: {
    chapter: 'Chapter',
    episode: 'Episode',
    unitChapter: 'chapter',
    unitEpisode: 'episode',
    statusOngoing: 'Berjalan',
    statusCompleted: 'Tamat',
    statusHiatus: 'Hiatus',
    statusCancelled: 'Dibatalkan',
    statusUnknown: 'Tidak diketahui',
    meta: '{source} · {count} {unit} · {unread} belum dibaca',
    inLibrary: 'Di library',
    addToLibrary: 'Tambah ke library',
    refreshing: 'Menyegarkan…',
    refresh: 'Segarkan',
    categories: 'Kategori',
    resume: 'Lanjut: {name}',
    resumeWatch: 'Lanjut tonton {name}',
    resumeRead: 'Lanjut baca {name}',
    collapse: 'Ringkas',
    expand: 'Selengkapnya',
    download: 'Unduh {count}',
    downloadPendingWatch: 'Unduh {count} episode yang belum ditonton',
    downloadPendingRead: 'Unduh {count} chapter yang belum dibaca',
    removeDownloaded: 'Hapus {count} {unit} terunduh',
    markAll: 'Tandai semua',
    reverse: 'Balik urutan',
    emptyItems: 'Belum ada {unit} yang tersimpan.',
    errorTitle: 'Entri tidak bisa dibuka',
    errorDescription:
      'Judul ini belum tersimpan di perangkat, dan extension sumbernya sedang tidak tersedia.',
    downloadedBadge: 'Sudah diunduh',
    inLibraryBadge: 'Ada di library',
    categoryPickerEmpty: 'Belum ada kategori. Buat dulu lewat tombol filter di halaman Library.',
  },

  item: {
    downloading: 'Mengunduh {progress}%',
    downloadFailed: 'Unduhan gagal, coba lagi',
    removeDownload: 'Hapus unduhan',
    download: 'Unduh {unit} ini',
    resumeAt: 'lanjut di {position}',
    downloadingShort: 'mengunduh {progress}%',
    failedShort: 'unduhan gagal',
    savedShort: 'tersimpan',
    bookmark: 'Tandai',
    removeBookmark: 'Hapus penanda',
    markUpTo: 'Tandai sampai sini sudah dibaca',
    markRead: 'Tandai sudah dibaca',
    markUnread: 'Tandai belum dibaca',
  },

  downloads: {
    title: 'Unduhan',
    pause: 'Jeda',
    resume: 'Lanjutkan',
    clearFinished: 'Bersihkan yang selesai',
    summary: '{working} berjalan · {finished} tersimpan',
    emptyTitle: 'Belum ada unduhan',
    emptyDescription:
      'Chapter dan episode yang kamu unduh bisa dibuka tanpa internet — tombol unduhnya ada di setiap barisnya.',
    queued: 'Menunggu giliran',
    running: 'Mengunduh',
    done: 'Tersimpan',
    paused: 'Terjeda',
    failed: 'Gagal',
    runningMeta: 'Mengunduh · {progress}%',
    cancel: 'Batalkan',
    remove: 'Hapus unduhan',
  },

  extensions: {
    title: 'Extension',
    searchPlaceholder: 'Cari extension…',
    showNsfw: 'Tampilkan sumber 18+',
    showNsfwLabel: 'Tampilkan sumber dewasa',
    showNsfwHint:
      'Saat dimatikan, paket bertanda dewasa disembunyikan dari halaman ini dan dari Browse.',
    loading: 'Memuat extension…',
    emptyTitle: 'Belum ada extension',
    emptyDescription: 'Tambahkan repo di atas, lalu pasang sumber yang kamu mau.',
    groupUpdatable: 'Update tersedia',
    groupInstalled: 'Terpasang',
    groupAvailable: 'Tersedia',
    groupCount: '{title} ({count})',
    subtitle: '{langs} · v{version} · {count} sumber',
    update: 'Update',
    updating: 'Memperbarui…',
    install: 'Pasang',
    installing: 'Memasang…',
    enable: 'Aktifkan {name}',
    preferences: 'Setelan {name}',
    uninstall: 'Copot {name}',
    tooNew: 'Butuh Mirai yang lebih baru (apiVersion {wanted}, app ini {current})',
    tooOld: 'Extension usang (apiVersion {wanted}, app ini {current})',

    repos: {
      heading: 'Repo extension',
      urlLabel: 'URL repo extension',
      add: 'Tambah repo',
      empty:
        'Mirai tidak membawa sumber bawaan. Tempel URL repo extension di atas — isinya berupa index.min.json beserta bundel di sebelahnya.',
      packageCount: '{count} paket',
      remove: 'Hapus repo {name}',
      hint: 'Menghapus repo tidak mencopot extension yang sudah terpasang — kodenya sudah tersimpan lokal. Yang hilang cuma jalur update-nya.',
    },
  },

  storage: {
    full: 'Ruang penyimpanan tinggal {free}. Hapus unduhan lama dulu sebelum mengunduh lagi.',
    low: 'Ruang tersisa {free} — satu episode bisa memakan ratusan MB.',
  },

  reader: {
    close: 'Tutup',
    settings: 'Setelan reader',
    previousChapter: 'Chapter sebelumnya',
    nextChapter: 'Chapter berikutnya',
    seek: 'Geser halaman',
    position: '{position} dari {total}',
    page: 'Halaman {number}',
    noPages: 'Chapter ini tidak punya halaman yang bisa ditampilkan.',
    mode: 'Mode baca',
    modeLtr: 'Kiri → kanan',
    modeRtl: 'Kanan → kiri',
    modeWebtoon: 'Gulir (webtoon)',
    fit: 'Ukuran halaman',
    fitWidth: 'Lebar',
    fitHeight: 'Tinggi',
    fitContain: 'Muat layar',
    preload: 'Halaman disiapkan di depan',
    preloadHint:
      'Makin banyak makin mulus, tapi makin boros kuota — halaman yang tidak jadi dibaca tetap terunduh.',
    tapZones: 'Ketuk sisi layar',
    tapZonesHint: 'Sisi kiri dan kanan berpindah halaman; tengah membuka menu.',
    fullscreen: 'Layar penuh',
    fullscreenHint: 'Menyembunyikan bilah sistem selama membaca.',
    orientation: 'Orientasi',
    orientationFree: 'Bebas',
    orientationPortrait: 'Tegak',
    orientationLandscape: 'Rebah',
    orientationWebNote:
      'Hanya berlaku di aplikasi Android; browser tidak mengizinkan aplikasi mengunci orientasi layar.',
    imageFailed: '{alt} gagal dimuat.',
    closeSettings: 'Tutup setelan',
  },

  errors: {
    chapterMissing: 'Chapter ini tidak ada di database.',
    chapterGone: 'Chapter ini sudah tidak ada di database.',
    episodeMissing: 'Episode ini tidak ada di database.',
    noPages: 'Sumber tidak mengembalikan satu halaman pun.',
    noVideos: 'Sumber tidak mengembalikan satu video pun.',
    entryMissing: 'Entri ini belum pernah disimpan dan extension sumbernya tidak terpasang.',
    entryNotSaved: 'Entri gagal disimpan ke database.',
    repoExists: 'Repo itu sudah ada di daftar',
    repoUnreachable:
      'Tidak bisa menghubungi {url}. Cek koneksi, atau repo itu mungkin tidak mengizinkan akses lintas origin.',
    sourceMissing:
      'Extension sumber judul ini tidak terpasang atau sedang dimatikan, jadi isinya tidak bisa diambil.',
    readerSourceMissing:
      'Chapter ini belum diunduh, jadi halamannya harus diambil dari internet — dan extension sumbernya tidak terpasang atau sedang dimatikan.',
    playerSourceMissing:
      'Episode ini belum diunduh, jadi videonya harus diambil dari internet — dan extension sumbernya tidak terpasang atau sedang dimatikan.',
    offline: 'Perangkat sedang offline dan chapter ini belum diunduh.',
    embedOnly:
      'Episode ini cuma tersedia lewat halaman pemutar pihak ketiga, yang tidak bisa diunduh.',
    noDownloadableVideo: 'Tidak ada video yang bisa diunduh.',
    noVariant: 'Master playlist ini tidak menawarkan satu kualitas pun.',
    playlistTooDeep: 'Playlist HLS ini bertingkat terlalu dalam.',
    playlistEmpty: 'Playlist HLS ini tidak berisi satu segmen pun.',
    emptyFile: 'Berkas kosong',
    hlsUnsupportedLocal: 'Browser ini tidak bisa memutar episode HLS yang terunduh.',
    hlsUnsupported: 'Browser ini tidak bisa memutar HLS.',
    videoNetwork: 'Video tidak bisa diambil. Cek jaringan atau coba host lain.',
    videoFailed: 'Video gagal diputar ({details}).',
    sourceNotManga: 'Sumber ini bukan sumber manga.',
    sourceNotAnime: 'Sumber ini bukan sumber anime.',
    repoUrlEmpty: 'URL repo kosong',
    repoUrlInvalid: 'Bukan URL yang sah: {url}',
    repoProtocol: 'Protokol {protocol} tidak didukung untuk repo extension',
    repoStatus: 'Repo menjawab {status} untuk {file}',
    repoNotJson: '{file} bukan JSON yang sah — apa URL-nya benar repo extension?',
    repoNotList: '{file} harus berupa daftar paket',
    extensionDownload: 'Gagal mengunduh {pkg} dari {url} ({status})',
    playlistRead: 'Playlist HLS gagal dibaca (HTTP {status}).',
    playlistFetch: 'Playlist HLS gagal diambil (HTTP {status}).',
    subtitleRead: 'Takarir gagal dibaca ({status})',
    subtitleFetch: 'Takarir gagal diambil ({status})',
    dirFailed: 'Tidak bisa membuat direktori untuk {path}',
    fileHttp: 'HTTP {status} saat mengambil berkas',
    coverFetch: 'Cover gagal diambil ({status})',
  },

  player: {
    close: 'Tutup',
    pip: 'Layar kecil',
    settings: 'Setelan pemutar',
    play: 'Putar',
    pause: 'Jeda',
    seek: 'Geser posisi tonton',
    skip: 'Lewati {seconds} detik',
    quality: 'Kualitas',
    changeQuality: 'Ganti kualitas',
    previousEpisode: 'Episode sebelumnya',
    nextEpisode: 'Episode berikutnya',
    position: '{position} dari {total}',
    noVideos: 'Episode ini tidak punya video yang bisa diputar.',
    qualityHeading: 'Kualitas & host',
    qualityHint: 'Berganti kualitas melanjutkan dari posisi yang sama, bukan mengulang dari awal.',
    downloadedQuality: 'Terunduh',
    subtitles: 'Takarir',
    subtitlesOff: 'Mati',
    speed: 'Kecepatan',
    skipStep: 'Lompatan tombol lewati',
    autoplayNext: 'Lanjut sendiri',
    autoplayNextHint: 'Membuka episode berikutnya begitu yang ini habis.',
    subtitlesOn: 'Takarir menyala',
    subtitlesOnHint: 'Takarir pertama dipilih otomatis kalau episodenya punya.',
    fullscreen: 'Layar penuh',
    fullscreenHint: 'Menyembunyikan bilah sistem selama menonton.',
    orientation: 'Orientasi',
    orientationFree: 'Bebas',
    orientationPortrait: 'Tegak',
    orientationLandscape: 'Rebah',
    orientationWebNote:
      'Hanya berlaku di aplikasi Android; browser tidak mengizinkan aplikasi mengunci orientasi layar.',
    embedNotice:
      'Host ini ({quality}) cuma menyediakan halaman pemutarnya sendiri, bukan berkas video. Bukalah halamannya, atau pilih host lain dari setelan.',
    openEmbed: 'Buka pemutarnya',
    pickAnotherHost: 'Pilih host lain',
    closeSettings: 'Tutup setelan',
    unsupportedFormat: 'Format video ini tidak didukung browser. Coba host atau kualitas lain.',
    playbackError: 'Video berhenti karena kesalahan pemutaran. Coba host atau kualitas lain.',
  },

  settings: {
    title: 'Pengaturan',

    downloads: {
      heading: 'Unduhan',
      description: 'Chapter yang diunduh tersimpan di perangkat dan tetap terbaca tanpa internet.',
      concurrency: 'Unduhan berbarengan',
      concurrencyHint:
        'Berapa chapter dikerjakan sekaligus. Halaman di dalam satu chapter selalu berurutan — menembakkan puluhan permintaan sekaligus adalah cara tercepat diblokir situs sumbernya.',
      deleteAfterRead: 'Hapus setelah dibaca',
      deleteAfterReadHint:
        'Berkas chapter dibuang begitu reader ditutup dan chapternya sudah tamat. Menghemat ruang kalau kebiasaannya mengunduh untuk sekali baca.',
      usage:
        'Terpakai {used} dari kuota {quota} yang diberikan browser. Angkanya mencakup seluruh data Mirai di peramban ini, bukan cuma unduhan.',
    },

    appearance: {
      heading: 'Tampilan',
      description: 'Bahasa antarmuka. Judul dan chapter tetap mengikuti bahasa sumbernya.',
      language: 'Bahasa',
      languageHint:
        'Berlaku seketika, tanpa memuat ulang. Bawaannya mengikuti bahasa perangkat kalau bahasa itu tersedia.',
      systemLanguage: 'Ikuti perangkat',
    },

    privacy: {
      heading: 'Privasi',
      incognito: 'Mode incognito',
      incognitoHint:
        'Selama menyala, membaca dan menonton tidak dicatat: riwayat tidak bertambah dan posisi terakhir tidak ikut tersimpan. Yang sudah tercatat sebelumnya tidak dihapus.',
      incognitoOff:
        'Mati sendiri setiap aplikasi ditutup — mode privat yang bertahan diam-diam berarti berhari-hari riwayat hilang tanpa disadari.',
    },

    backup: {
      heading: 'Backup',
      description:
        'Menyalin library, kategori, progres baca, riwayat, dan daftar extension ke satu berkas JSON. Berkas unduhan tidak ikut — ukurannya bisa gigabita, dan chapternya bisa diunduh ulang.',
      export: 'Buat backup',
      import: 'Pulihkan dari berkas',
      stagedTitle: 'Backup dari {date}',
      stagedUnknownDate: 'tanggal tidak diketahui',
      stagedCounts:
        '{entries} judul · {categories} kategori · {items} chapter/episode · {history} riwayat · {extensions} extension',
      mergeNotice:
        'Isinya digabung dengan yang sudah ada di perangkat ini. Tidak ada yang dihapus; judul yang sama dimenangkan berkas backup.',
      confirm: 'Pulihkan sekarang',
      exported: 'Backup tersimpan sebagai {name}',
      restored: '{entries} judul, {items} chapter/episode, dan {history} riwayat dipulihkan',
      restoredExtensions: ', {count} extension dipasang ulang',
      notJson: 'Berkasnya bukan JSON yang sah.',
      notMirai: 'Berkas ini bukan backup Mirai.',
      tooNew:
        'Backup ini dibuat Mirai yang lebih baru (format v{version}). Perbarui aplikasinya dulu.',
    },

    advanced: {
      heading: 'Lanjutan',
      description: 'Setelan jaringan. Tidak perlu disentuh selama sumbernya jalan.',
      userAgent: 'User-Agent',
      userAgentHint:
        'Menimpa identitas browser yang dikirim semua extension. Kosongkan untuk membiarkan tiap extension memilih sendiri — itu bawaannya, dan biasanya yang paling benar. Gunanya kalau sebuah situs menahan Mirai dengan verifikasi Cloudflare: izin hasil verifikasi hanya berlaku untuk User-Agent yang menyelesaikannya, jadi keduanya harus sama persis.',
      userAgentPlaceholder: 'Kosong — pakai bawaan extension',
      useBrowserAgent: 'Pakai UA browser ini',
      resetUserAgent: 'Kembalikan ke bawaan',
      userAgentActive: 'Aktif. Berlaku untuk request berikutnya, tanpa perlu memuat ulang.',
      userAgentInactive: 'Nonaktif — extension memakai User-Agent-nya sendiri.',
      userAgentWebNote:
        'Di versi web, request tetap dikirim proxy dari mesin lain, jadi mengganti User-Agent saja tidak cukup untuk melewati verifikasi Cloudflare.',
    },
  },
}
