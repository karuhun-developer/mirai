import type { id } from './id'

/**
 * English catalogue.
 *
 * Typed as `typeof id`, so a key that exists in Indonesian and not here is a
 * compile error rather than an Indonesian sentence leaking into the English UI.
 * Indonesian stays the source of truth: new strings are written there first.
 */
export const en: typeof id = {
  common: {
    search: 'Search',
    filter: 'Filter',
    refresh: 'Refresh',
    retry: 'Try again',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    remove: 'Remove',
    back: 'Back',
    mainNav: 'Main navigation',
    anime: 'Anime',
    manga: 'Manga',
    loading: 'Loading…',
  },

  nav: {
    anime: 'Anime',
    manga: 'Manga',
    updates: 'Updates',
    browse: 'Browse',
    more: 'More',
    downloads: 'Downloads',
    extensions: 'Extensions',
    settings: 'Settings',
    history: 'History',
    about: 'About',
    home: 'Mirai — home',
  },

  more: {
    title: 'More',
    history: 'Recently read & watched',
    downloads: 'Queue & offline content',
    extensions: 'Repos & sources',
    settings: 'Appearance & storage',
    about: 'Version & licence',
  },

  about: {
    title: 'About',
    version: 'Version {version}',
    intro:
      'Mirai is a manga reader and anime player that ships with no content sources at all. Every catalogue comes from extensions you install yourself.',
    responsibility:
      'You are responsible for the extension repos you add and for complying with the terms of service of the sites they scrape.',
  },

  notFound: {
    title: 'Page not found',
    description: 'The link may have changed, or it was mistyped.',
    back: 'Back to Library',
  },

  cloudflare: {
    title: '{source} is asking for Cloudflare verification',
    body: 'The site is up, but it is holding Mirai behind a "verify you are human" check. Mirai does not work around that check — you solve it yourself, then come back here and refresh.',
    webWarningStrong: 'This will not work on the web build.',
    webWarning:
      'Requests go through a proxy on another machine, while the clearance from the check sticks to the browser and IP address that solved it. Use the APK, or pick another source.',
    solve: 'Solve the verification',
    openSite: 'Open the site',
    changeUserAgent: 'Change User-Agent',
    stillBlocked:
      'If it still blocks you after solving the check, that source simply is not usable right now.',
  },

  library: {
    searchPlaceholder: 'Search the library…',
    searchLabel: 'Search the library',
    categories: 'Categories',
    refreshing: 'Refreshing {done}/{total} — {title}',
    emptyTitle: 'Your {kind} library is empty',
    emptyDescription:
      'Install an extension, then mark titles as favourites — they stay here even while you are offline.',
    browse: 'Browse sources',
    noMatchTitle: 'Nothing matches',
    noMatchDescription: 'Try a different keyword, category, or filter.',
    allCategories: 'All',
    uncategorized: 'Uncategorised',

    filters: {
      sort: 'Sort by',
      sortTitle: 'Title',
      sortAdded: 'Date added',
      sortLastRead: 'Last read',
      sortUnread: 'Unread',
      filter: 'Filter',
      unreadOnly: 'Has unread',
      downloadedOnly: 'Downloaded',
      categories: 'Categories',
      dropCategory: 'Delete category {name}',
      newCategory: 'New category…',
      newCategoryLabel: 'New category name',
      addCategory: 'Add category',
      dropHint: 'Deleting a category does not delete the titles inside it.',
    },
  },

  updates: {
    title: 'Updates',
    progress: '{done}/{total} — {title}',
    report: '{checked} titles checked, {added} new items.',
    skipped: '{count} skipped (extension not installed).',
    failed: '{count} failed.',
    markRead: 'Mark as read',
    markUnread: 'Mark as unread',
    emptyTitle: 'No updates yet',
    emptyDescription:
      'New chapters and episodes from titles in your library show up here after a refresh.',
    refreshNow: 'Refresh now',
  },

  history: {
    title: 'History',
    clear: 'Clear all history',
    remove: 'Remove from history',
    emptyTitle: 'History is empty',
    emptyDescription:
      'Chapters and episodes you have read or watched are recorded here — all of it stored locally.',
  },

  browse: {
    title: 'Browse',
    loading: 'Loading extensions…',
    emptyTitle: 'No active sources yet',
    emptyDescription:
      'Mirai ships with no built-in sources. Add an extension repo first, then install the sources you want.',
    openExtensions: 'Open Extensions',
    searchPlaceholder: 'Search titles…',
    popular: 'Popular',
    latest: 'Latest',
    sourceFallback: 'Source',
    thisSource: 'This source',
    notFoundTitle: 'Source not found',
    notFoundDescription: 'The extension for {id} is not installed.',
    noResults: 'No results.',
    loadMore: 'Load more',
  },

  entry: {
    chapter: 'Chapter',
    episode: 'Episode',
    unitChapter: 'chapter',
    unitEpisode: 'episode',
    statusOngoing: 'Ongoing',
    statusCompleted: 'Completed',
    statusHiatus: 'Hiatus',
    statusCancelled: 'Cancelled',
    statusUnknown: 'Unknown',
    meta: '{source} · {count} {unit} · {unread} unread',
    inLibrary: 'In library',
    addToLibrary: 'Add to library',
    refreshing: 'Refreshing…',
    refresh: 'Refresh',
    categories: 'Categories',
    resume: 'Resume: {name}',
    resumeWatch: 'Resume watching {name}',
    resumeRead: 'Resume reading {name}',
    collapse: 'Show less',
    expand: 'Show more',
    download: 'Download {count}',
    downloadPendingWatch: 'Download {count} unwatched episodes',
    downloadPendingRead: 'Download {count} unread chapters',
    removeDownloaded: 'Delete {count} downloaded {unit}',
    markAll: 'Mark all',
    reverse: 'Reverse order',
    emptyItems: 'No {unit} stored yet.',
    errorTitle: 'This entry cannot be opened',
    errorDescription:
      'The title is not stored on this device, and its source extension is unavailable right now.',
    downloadedBadge: 'Downloaded',
    inLibraryBadge: 'In library',
    categoryPickerEmpty:
      'No categories yet. Create one from the filter button on the Library page.',
  },

  item: {
    downloading: 'Downloading {progress}%',
    downloadFailed: 'Download failed, try again',
    removeDownload: 'Delete download',
    download: 'Download this {unit}',
    resumeAt: 'stopped at {position}',
    downloadingShort: 'downloading {progress}%',
    failedShort: 'download failed',
    savedShort: 'saved',
    bookmark: 'Bookmark',
    removeBookmark: 'Remove bookmark',
    markUpTo: 'Mark everything up to here as read',
    markRead: 'Mark as read',
    markUnread: 'Mark as unread',
  },

  downloads: {
    title: 'Downloads',
    pause: 'Pause',
    resume: 'Resume',
    clearFinished: 'Clear finished',
    summary: '{working} running · {finished} saved',
    emptyTitle: 'No downloads yet',
    emptyDescription:
      'Chapters and episodes you download open with no internet — the download button sits on every row.',
    queued: 'Waiting its turn',
    running: 'Downloading',
    done: 'Saved',
    paused: 'Paused',
    failed: 'Failed',
    runningMeta: 'Downloading · {progress}%',
    cancel: 'Cancel',
    remove: 'Delete download',
  },

  extensions: {
    title: 'Extensions',
    searchPlaceholder: 'Search extensions…',
    showNsfw: 'Show 18+ sources',
    showNsfwLabel: 'Show adult sources',
    showNsfwHint:
      'While it is off, packages flagged adult are hidden from this page and from Browse.',
    loading: 'Loading extensions…',
    emptyTitle: 'No extensions yet',
    emptyDescription: 'Add a repo above, then install the sources you want.',
    groupUpdatable: 'Update available',
    groupInstalled: 'Installed',
    groupAvailable: 'Available',
    groupCount: '{title} ({count})',
    subtitle: '{langs} · v{version} · {count} sources',
    update: 'Update',
    updating: 'Updating…',
    install: 'Install',
    installing: 'Installing…',
    enable: 'Enable {name}',
    preferences: '{name} settings',
    uninstall: 'Uninstall {name}',
    tooNew: 'Needs a newer Mirai (apiVersion {wanted}, this app {current})',
    tooOld: 'Outdated extension (apiVersion {wanted}, this app {current})',

    repos: {
      heading: 'Extension repos',
      urlLabel: 'Extension repo URL',
      add: 'Add repo',
      empty:
        'Mirai ships with no built-in sources. Paste an extension repo URL above — it serves an index.min.json with the bundles next to it.',
      packageCount: '{count} packages',
      remove: 'Remove repo {name}',
      hint: 'Removing a repo does not uninstall the extensions you already have — their code is stored locally. You only lose the update path.',
    },
  },

  storage: {
    full: 'Only {free} of storage left. Delete old downloads before downloading again.',
    low: '{free} left — a single episode can eat hundreds of MB.',
  },

  reader: {
    close: 'Close',
    settings: 'Reader settings',
    previousChapter: 'Previous chapter',
    nextChapter: 'Next chapter',
    seek: 'Seek page',
    position: '{position} of {total}',
    page: 'Page {number}',
    noPages: 'This chapter has no pages to show.',
    mode: 'Reading mode',
    modeLtr: 'Left → right',
    modeRtl: 'Right → left',
    modeWebtoon: 'Scroll (webtoon)',
    fit: 'Page size',
    fitWidth: 'Width',
    fitHeight: 'Height',
    fitContain: 'Fit screen',
    preload: 'Pages loaded ahead',
    preloadHint:
      'More is smoother but heavier on data — pages you never reach are downloaded anyway.',
    tapZones: 'Tap screen edges',
    tapZonesHint: 'The left and right edges turn the page; the middle opens the menu.',
    fullscreen: 'Fullscreen',
    fullscreenHint: 'Hides the system bars while reading.',
    orientation: 'Orientation',
    orientationFree: 'Free',
    orientationPortrait: 'Portrait',
    orientationLandscape: 'Landscape',
    orientationWebNote:
      'Only works in the Android app; browsers do not let a page lock screen orientation.',
    imageFailed: '{alt} failed to load.',
    closeSettings: 'Close settings',
  },

  migrate: {
    action: 'Migrate',
    title: 'Move to another source',
    description:
      'The title is searched in the target source, then reading progress, bookmarks, categories, and history move to the chapters with the same number.',
    query: 'Title to search for',
    noTargets:
      'There is no other source of this kind yet. Install another extension first on the Extensions page.',
    noResults: 'This source found no matching title. Try different keywords.',
    removeOld: 'Delete the old title',
    removeOldHint:
      'Along with its downloads. If turned off, the old title is only removed from the library and keeps its progress.',
    downloadsNotice:
      'Downloaded files do not move — chapters on the new source have different pages, so they have to be downloaded again.',
    confirm: 'Move',
    running: 'Moving…',
  },

  errors: {
    chapterMissing: 'This chapter is not in the database.',
    chapterGone: 'This chapter is no longer in the database.',
    episodeMissing: 'This episode is not in the database.',
    noPages: 'The source returned no pages at all.',
    noVideos: 'The source returned no videos at all.',
    entryMissing: 'This entry was never stored, and its source extension is not installed.',
    entryNotSaved: 'The entry could not be stored in the database.',
    migrateSame: 'This title already lives on that source.',
    repoExists: 'That repo is already in the list',
    repoUnreachable:
      'Cannot reach {url}. Check your connection, or that repo may not allow cross-origin access.',
    sourceMissing:
      'The source extension for this title is not installed or is disabled, so its contents cannot be fetched.',
    readerSourceMissing:
      'This chapter is not downloaded, so its pages have to come from the internet — and its source extension is not installed or is disabled.',
    playerSourceMissing:
      'This episode is not downloaded, so its video has to come from the internet — and its source extension is not installed or is disabled.',
    offline: 'The device is offline and this chapter is not downloaded.',
    embedOnly:
      'This episode is only available through a third-party player page, which cannot be downloaded.',
    noDownloadableVideo: 'There is no downloadable video.',
    noVariant: 'This master playlist offers no quality at all.',
    playlistTooDeep: 'This HLS playlist nests too deep.',
    playlistEmpty: 'This HLS playlist contains no segments at all.',
    emptyFile: 'Empty file',
    hlsUnsupportedLocal: 'This browser cannot play downloaded HLS episodes.',
    hlsUnsupported: 'This browser cannot play HLS.',
    videoNetwork: 'The video could not be fetched. Check the network or try another host.',
    videoFailed: 'The video failed to play ({details}).',
    sourceNotManga: 'This source is not a manga source.',
    sourceNotAnime: 'This source is not an anime source.',
    repoUrlEmpty: 'The repo URL is empty',
    repoUrlInvalid: 'Not a valid URL: {url}',
    repoProtocol: 'The {protocol} protocol is not supported for extension repos',
    repoStatus: 'The repo answered {status} for {file}',
    repoNotJson: '{file} is not valid JSON — is that URL really an extension repo?',
    repoNotList: '{file} must be a list of packages',
    extensionDownload: 'Failed to download {pkg} from {url} ({status})',
    playlistRead: 'The HLS playlist could not be read (HTTP {status}).',
    playlistFetch: 'The HLS playlist could not be fetched (HTTP {status}).',
    subtitleRead: 'The subtitle track could not be read ({status})',
    subtitleFetch: 'The subtitle track could not be fetched ({status})',
    dirFailed: 'Could not create a directory for {path}',
    fileHttp: 'HTTP {status} while fetching the file',
    coverFetch: 'The cover could not be fetched ({status})',
  },

  player: {
    close: 'Close',
    pip: 'Picture in picture',
    settings: 'Player settings',
    play: 'Play',
    pause: 'Pause',
    seek: 'Seek position',
    skip: 'Skip {seconds} seconds',
    quality: 'Quality',
    changeQuality: 'Change quality',
    previousEpisode: 'Previous episode',
    nextEpisode: 'Next episode',
    position: '{position} of {total}',
    noVideos: 'This episode has no playable video.',
    qualityHeading: 'Quality & host',
    qualityHint: 'Switching quality resumes from the same position instead of starting over.',
    downloadedQuality: 'Downloaded',
    subtitles: 'Subtitles',
    subtitlesOff: 'Off',
    speed: 'Speed',
    skipStep: 'Skip button step',
    autoplayNext: 'Autoplay next',
    autoplayNextHint: 'Opens the next episode as soon as this one ends.',
    subtitlesOn: 'Subtitles on',
    subtitlesOnHint: 'The first subtitle track is picked automatically when the episode has one.',
    fullscreen: 'Fullscreen',
    fullscreenHint: 'Hides the system bars while watching.',
    orientation: 'Orientation',
    orientationFree: 'Free',
    orientationPortrait: 'Portrait',
    orientationLandscape: 'Landscape',
    orientationWebNote:
      'Only works in the Android app; browsers do not let a page lock screen orientation.',
    embedNotice:
      'This host ({quality}) only serves its own player page, not a video file. Open that page, or pick another host from the settings.',
    openEmbed: 'Open the player',
    pickAnotherHost: 'Pick another host',
    closeSettings: 'Close settings',
    unsupportedFormat:
      'This browser does not support the video format. Try another host or quality.',
    playbackError: 'Playback stopped because of an error. Try another host or quality.',
  },

  settings: {
    title: 'Settings',

    downloads: {
      heading: 'Downloads',
      description: 'Downloaded chapters live on the device and stay readable with no internet.',
      concurrency: 'Parallel downloads',
      concurrencyHint:
        'How many chapters run at once. Pages within a chapter are always sequential — firing dozens of requests at once is the fastest way to get blocked by the source site.',
      deleteAfterRead: 'Delete after reading',
      deleteAfterReadHint:
        'Chapter files are dropped as soon as the reader closes and the chapter is finished. Saves space if you download to read once.',
      usage:
        '{used} used of the {quota} quota the browser grants. That covers all Mirai data in this browser, not just downloads.',
    },

    appearance: {
      heading: 'Appearance',
      description: 'Interface language. Titles and chapters keep the language of their source.',
      language: 'Language',
      languageHint:
        'Applies immediately, with no reload. The default follows your device language when that language is available.',
      systemLanguage: 'Follow device',
    },

    privacy: {
      heading: 'Privacy',
      incognito: 'Incognito mode',
      incognitoHint:
        'While it is on, reading and watching are not recorded: history does not grow and the last position is not saved. Anything already recorded stays.',
      incognitoOff:
        'Turns itself off every time the app closes — a private mode that quietly persists means days of history lost without anyone noticing.',
    },

    backup: {
      heading: 'Backup',
      description:
        'Copies the library, categories, reading progress, history, and extension list into a single JSON file. Downloaded files are not included — they can run to gigabytes, and chapters can be downloaded again.',
      export: 'Create backup',
      import: 'Restore from file',
      stagedTitle: 'Backup from {date}',
      stagedUnknownDate: 'an unknown date',
      stagedCounts:
        '{entries} titles · {categories} categories · {items} chapters/episodes · {history} history entries · {extensions} extensions',
      mergeNotice:
        'The contents are merged into what is already on this device. Nothing is deleted; where a title exists on both sides, the backup wins.',
      confirm: 'Restore now',
      exported: 'Backup saved as {name}',
      restored:
        '{entries} titles, {items} chapters/episodes, and {history} history entries restored',
      restoredExtensions: ', {count} extensions reinstalled',
      notJson: 'That file is not valid JSON.',
      notMirai: 'That file is not a Mirai backup.',
      tooNew: 'This backup was made by a newer Mirai (format v{version}). Update the app first.',
    },

    advanced: {
      heading: 'Advanced',
      description: 'Network settings. No need to touch these while your sources work.',
      userAgent: 'User-Agent',
      userAgentHint:
        'Overrides the browser identity every extension sends. Leave it empty to let each extension pick its own — that is the default, and usually the right one. It matters when a site holds Mirai behind Cloudflare verification: the clearance only applies to the User-Agent that solved it, so the two have to match exactly.',
      userAgentPlaceholder: 'Empty — use the extension default',
      useBrowserAgent: 'Use this browser’s UA',
      resetUserAgent: 'Reset to default',
      userAgentActive: 'Active. Applies to the next request, no reload needed.',
      userAgentInactive: 'Off — extensions use their own User-Agent.',
      userAgentWebNote:
        'On the web build, requests still go through a proxy on another machine, so changing the User-Agent alone is not enough to pass Cloudflare verification.',
    },
  },
}
