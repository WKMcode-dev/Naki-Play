import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  analyzeExternalMedia,
  bootstrapLibrary,
  cancelExternalDownload,
  chooseAndImportTracks,
  confirmTrackDeletion,
  persistDeletePlaylist,
  persistRenamePlaylist,
  persistTrackMetadata,
  defaultSettings,
  downloadDirectTrack,
  downloadExternalMedia,
  hydrateTrack,
  importNativePaths,
  listenForNativeDrops,
  persistAddToPlaylist,
  persistDeleteTrack,
  persistPlaylist,
  persistPlaylistOrder,
  persistRemoveFromPlaylist,
  persistSettings,
  persistTrackFlag,
  runningInTauri,
} from '../services/nativeLibrary'
import type {
  AppSettings,
  ExternalMediaAnalysis,
  LibraryView,
  MediaDownloadStatus,
  MediaTrack,
  NativeDownloadEvent,
  Playlist,
  RepeatMode,
} from '../types/library'

const supportedExtensions = new Set([
  'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'mp4', 'webm', 'mov',
])

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '').replaceAll(/[_-]+/g, ' ').trim()
}

function canImport(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return file.type.startsWith('audio/') || file.type.startsWith('video/') || supportedExtensions.has(extension)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function contrastTextColor(hexColor: string) {
  const normalized = hexColor.replace('#', '')
  const expanded = normalized.length === 3
    ? normalized.split('').map((value) => value.repeat(2)).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return '#ffffff'
  const channels = [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255)
  const [red, green, blue] = channels.map((value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  const whiteContrast = 1.05 / (luminance + 0.05)
  const darkContrast = (luminance + 0.05) / 0.06
  return whiteContrast >= darkContrast ? '#ffffff' : '#191919'
}

function uniqueIds(trackIds: string[]) {
  return [...new Set(trackIds)]
}

function shuffledFromCurrent(trackIds: string[], currentTrackId?: string) {
  const remaining = trackIds.filter((trackId) => trackId !== currentTrackId)
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[remaining[index], remaining[target]] = [remaining[target], remaining[index]]
  }
  return currentTrackId && trackIds.includes(currentTrackId)
    ? [currentTrackId, ...remaining]
    : remaining
}

function waitForMediaRelease() {
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(fallback)
      resolve()
    }
    const fallback = window.setTimeout(finish, 140)
    window.requestAnimationFrame(() => window.requestAnimationFrame(finish))
  })
}

export function useLibrary() {
  const [tracks, setTracks] = useState<MediaTrack[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const catalogPending = useRef(false)
  const [isCatalogBusy, setIsCatalogBusy] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [activeView, setActiveView] = useState<LibraryView>('home')
  const [currentTrackId, setCurrentTrackId] = useState<string>()
  const [playbackQueue, setPlaybackQueue] = useState<string[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [error, setError] = useState<string>()
  const [mediaAnalysis, setMediaAnalysis] = useState<ExternalMediaAnalysis>()
  const [downloadStatus, setDownloadStatus] = useState<MediaDownloadStatus>({
    stage: 'idle',
    progress: 0,
  })
  const cancelledJobId = useRef<string | undefined>(undefined)
  const shuffledQueue = useRef<string[]>([])

  useEffect(() => {
    void bootstrapLibrary()
      .then((snapshot) => {
        setTracks(snapshot.tracks)
        setPlaylists(snapshot.playlists)
        setSettings(snapshot.settings)
        setCurrentTrackId(snapshot.tracks[0]?.id)
        setPlaybackQueue(snapshot.tracks.map((track) => track.id))
      })
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setIsReady(true))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.themeMode
    root.dataset.compact = String(settings.compactMode)
    root.dataset.reduceMotion = String(settings.reduceMotion)
    root.style.setProperty('--theme-primary', settings.primaryColor)
    root.style.setProperty('--theme-accent', settings.accentColor)
    root.style.setProperty('--theme-light-bg', settings.lightBackground)
    root.style.setProperty('--theme-dark-bg', settings.darkBackground)
    root.style.setProperty('--theme-on-primary', contrastTextColor(settings.primaryColor))
    root.style.setProperty('--theme-on-accent', contrastTextColor(settings.accentColor))
    document.title = `${settings.appTitle} Play`

    if (runningInTauri()) {
      void import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => getCurrentWindow().setTitle(`${settings.appTitle} Play`))
        .catch(() => undefined)
    }
  }, [settings])

  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === currentTrackId),
    [currentTrackId, tracks],
  )

  function clearMessages() {
    setError(undefined)
    setNotice(undefined)
  }

  const acceptImportedTracks = useCallback((imported: MediaTrack[]) => {
    if (imported.length === 0) return
    setTracks((current) => [...imported, ...current])
    setCurrentTrackId(imported[0].id)
    setPlaybackQueue((current) => uniqueIds([...imported.map((track) => track.id), ...current]))
    setIsPlaying(true)
    setActiveView('downloads')
    setNotice(`${imported.length} ${imported.length === 1 ? 'música adicionada' : 'músicas adicionadas'} à biblioteca`)
  }, [])

  const importPaths = useCallback(async (paths: string[]) => {
    clearMessages()
    setIsBusy(true)
    try {
      acceptImportedTracks(await importNativePaths(paths))
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setIsBusy(false)
    }
  }, [acceptImportedTracks])

  useEffect(() => {
    let stopListening: (() => void) | undefined
    void listenForNativeDrops(importPaths).then((unlisten) => {
      stopListening = unlisten
    })
    return () => stopListening?.()
  }, [importPaths])

  function playTrack(trackId: string, queueIds?: string[]) {
    if (queueIds?.length) {
      const nextQueue = uniqueIds(queueIds)
      setPlaybackQueue(nextQueue)
      if (settings.shuffleEnabled) {
        shuffledQueue.current = shuffledFromCurrent(nextQueue, trackId)
      }
    }
    if (trackId === currentTrackId) {
      setIsPlaying((playing) => !playing)
      return
    }
    setCurrentTrackId(trackId)
    setIsPlaying(true)
  }

  function playbackOrder() {
    const availableIds = new Set(tracks.map((track) => track.id))
    const queue = uniqueIds(
      (playbackQueue.length ? playbackQueue : tracks.map((track) => track.id))
        .filter((trackId) => availableIds.has(trackId)),
    )
    if (!settings.shuffleEnabled) return queue

    const queuedIds = new Set(queue)
    const shuffled = shuffledQueue.current.filter((trackId) => queuedIds.has(trackId))
    if (shuffled.length !== queue.length) {
      shuffledQueue.current = shuffledFromCurrent(queue, currentTrackId)
    }
    return shuffledQueue.current
  }

  function playAdjacent(direction: 1 | -1, fromEnded = false) {
    const order = playbackOrder()
    if (order.length === 0) return
    const locatedIndex = order.indexOf(currentTrackId ?? '')
    const currentIndex = locatedIndex >= 0
      ? locatedIndex
      : direction === 1 ? -1 : order.length
    const candidateIndex = currentIndex + direction
    const reachedBoundary = candidateIndex < 0 || candidateIndex >= order.length
    if (fromEnded && reachedBoundary) {
      setIsPlaying(false)
      return
    }
    const nextIndex = (candidateIndex + order.length) % order.length
    setCurrentTrackId(order[nextIndex])
    setIsPlaying(true)
  }

  function handleTrackEnded() {
    if (!settings.autoplay) {
      setIsPlaying(false)
      return
    }
    playAdjacent(1, true)
  }

  async function updatePlaybackSettings(nextSettings: AppSettings) {
    setSettings(nextSettings)
    try {
      setSettings(await persistSettings(nextSettings))
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  function toggleShuffle() {
    const shuffleEnabled = !settings.shuffleEnabled
    if (shuffleEnabled) {
      shuffledQueue.current = shuffledFromCurrent(playbackOrder(), currentTrackId)
    } else {
      shuffledQueue.current = []
    }
    void updatePlaybackSettings({ ...settings, shuffleEnabled })
  }

  function cycleRepeatMode() {
    const repeatMode: RepeatMode = settings.repeatMode === 'one' ? 'off' : 'one'
    void updatePlaybackSettings({ ...settings, repeatMode })
  }

  async function toggleLike(trackId: string) {
    const track = tracks.find((item) => item.id === trackId)
    if (!track) return
    const value = !track.isLiked
    setTracks((current) => current.map((item) => item.id === trackId ? { ...item, isLiked: value } : item))
    try {
      await persistTrackFlag('set_track_liked', trackId, value)
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  async function toggleFavorite(trackId: string) {
    const track = tracks.find((item) => item.id === trackId)
    if (!track) return
    const value = !track.isFavorite
    setTracks((current) => current.map((item) => item.id === trackId ? { ...item, isFavorite: value } : item))
    try {
      await persistTrackFlag('set_track_favorite', trackId, value)
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  async function deleteTrack(trackId: string) {
    const track = tracks.find((item) => item.id === trackId)
    if (!track) return
    try {
      if (!(await confirmTrackDeletion(track.title))) return
    } catch (reason) {
      setError(errorMessage(reason))
      return
    }

    clearMessages()
    const wasCurrent = currentTrackId === trackId
    const wasPlaying = wasCurrent && isPlaying
    const orderBeforeDeletion = playbackOrder()
    const deletedIndex = orderBeforeDeletion.indexOf(trackId)
    const remainingOrder = orderBeforeDeletion.filter((id) => id !== trackId)
    const nextTrackId = wasCurrent && remainingOrder.length > 0
      ? remainingOrder[Math.min(Math.max(deletedIndex, 0), remainingOrder.length - 1)]
      : undefined

    if (wasCurrent) {
      setIsPlaying(false)
      setCurrentTrackId(undefined)
      await waitForMediaRelease()
    }

    try {
      await persistDeleteTrack(trackId)
      if (track.fileUrl?.startsWith('blob:')) URL.revokeObjectURL(track.fileUrl)
      setTracks((current) => current.filter((item) => item.id !== trackId))
      setPlaylists((current) => current.map((playlist) => ({
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => id !== trackId),
      })))
      setPlaybackQueue((current) => current.filter((id) => id !== trackId))
      shuffledQueue.current = shuffledQueue.current.filter((id) => id !== trackId)
      if (wasCurrent) {
        setCurrentTrackId(nextTrackId)
        setIsPlaying(wasPlaying && Boolean(nextTrackId))
      }
      setNotice('Música excluída deste dispositivo.')
    } catch (reason) {
      if (wasCurrent) {
        setCurrentTrackId(trackId)
        setIsPlaying(wasPlaying)
      }
      setError(errorMessage(reason))
    }
  }

  function importBrowserFiles(files: FileList | File[]) {
    const imported = Array.from(files).filter(canImport).map<MediaTrack>((file, index) => hydrateTrack({
      id: crypto.randomUUID(),
      title: titleFromFileName(file.name) || 'Faixa sem nome',
      artist: 'Arquivo pessoal',
      album: 'Sessão do navegador',
      durationLabel: '—:—',
      durationSeconds: 0,
      source: 'local',
      isLiked: false,
      isFavorite: false,
      cover: '',
      coverSeed: index,
      fileUrl: URL.createObjectURL(file),
      fileName: file.name,
    }))
    acceptImportedTracks(imported)
    return imported.length
  }

  async function importFromPicker() {
    clearMessages()
    setIsBusy(true)
    try {
      acceptImportedTracks(await chooseAndImportTracks())
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setIsBusy(false)
    }
  }

  async function downloadFromUrl(url: string) {
    clearMessages()
    setIsBusy(true)
    try {
      const track = await downloadDirectTrack(url)
      acceptImportedTracks([track])
      return true
    } catch (reason) {
      setError(errorMessage(reason))
      return false
    } finally {
      setIsBusy(false)
    }
  }

  async function analyzeMedia(url: string) {
    clearMessages()
    setIsBusy(true)
    setMediaAnalysis(undefined)
    setDownloadStatus({ stage: 'idle', progress: 0 })
    try {
      const analysis = await analyzeExternalMedia(url)
      setMediaAnalysis(analysis)
      setNotice('Link analisado. Agora escolha o formato que você quer.')
      return true
    } catch (reason) {
      setError(errorMessage(reason))
      return false
    } finally {
      setIsBusy(false)
    }
  }

  function handleDownloadEvent(event: NativeDownloadEvent) {
    if (event.event === 'preparing') {
      setDownloadStatus((current) => ({
        ...current,
        stage: 'preparing',
        message: event.data.message,
      }))
    } else if (event.event === 'progress') {
      setDownloadStatus((current) => ({
        ...current,
        stage: 'downloading',
        progress: event.data.progress,
        etaSeconds: event.data.etaSeconds,
        message: event.data.message,
      }))
    } else if (event.event === 'converting') {
      setDownloadStatus((current) => ({
        ...current,
        stage: 'converting',
        progress: Math.max(current.progress, 96),
        message: event.data.message,
      }))
    } else {
      setDownloadStatus((current) => ({
        ...current,
        stage: 'finished',
        progress: 100,
        message: 'Download concluído e adicionado à biblioteca.',
      }))
    }
  }

  async function downloadAnalyzedMedia(optionId: string, confirmedAuthorized: boolean) {
    if (!mediaAnalysis) return false
    clearMessages()
    setIsBusy(true)
    const jobId = crypto.randomUUID()
    cancelledJobId.current = undefined
    setDownloadStatus({
      stage: 'preparing',
      progress: 0,
      jobId,
      message: 'Preparando o download…',
    })
    try {
      const track = await downloadExternalMedia({
        analysis: mediaAnalysis,
        optionId,
        jobId,
        confirmedAuthorized,
      }, handleDownloadEvent)
      acceptImportedTracks([track])
      setDownloadStatus((current) => ({
        ...current,
        stage: 'finished',
        progress: 100,
        message: 'Pronto! O arquivo já está na biblioteca.',
      }))
      return true
    } catch (reason) {
      setDownloadStatus({ stage: 'idle', progress: 0 })
      if (cancelledJobId.current === jobId) {
        setNotice('Download cancelado.')
      } else {
        setError(errorMessage(reason))
      }
      return false
    } finally {
      setIsBusy(false)
    }
  }

  async function cancelMediaDownload() {
    if (!downloadStatus.jobId) return
    const jobId = downloadStatus.jobId
    cancelledJobId.current = jobId
    setDownloadStatus((current) => ({
      ...current,
      stage: 'cancelling',
      message: 'Cancelando…',
    }))
    try {
      const cancelled = await cancelExternalDownload(jobId)
      if (!cancelled) throw new Error('O download já havia terminado ou não pôde ser localizado.')
      setDownloadStatus({ stage: 'idle', progress: 0 })
      setNotice('Download cancelado.')
    } catch (reason) {
      if (cancelledJobId.current === jobId) cancelledJobId.current = undefined
      setError(errorMessage(reason))
    }
  }

  function clearMediaAnalysis() {
    if (isBusy) return
    setMediaAnalysis(undefined)
    setDownloadStatus({ stage: 'idle', progress: 0 })
    clearMessages()
  }

  async function mutateCatalog(action: () => Promise<void>) {
    if (catalogPending.current) return false
    catalogPending.current = true
    setIsCatalogBusy(true)
    clearMessages()
    try {
      await action()
      return true
    } catch (reason) {
      setError(errorMessage(reason))
      return false
    } finally {
      catalogPending.current = false
      setIsCatalogBusy(false)
    }
  }

  async function createPlaylist(name: string) {
    return mutateCatalog(async () => {
      const playlist = await persistPlaylist(name.trim())
      setPlaylists((current) => [...current, playlist])
      setActiveView(`playlist:${playlist.id}`)
      setNotice('Playlist criada.')
    })
  }

  async function renamePlaylist(playlistId: string, name: string) {
    return mutateCatalog(async () => {
      name = name.trim()
      if (!name || name.length > 80) throw new Error('Informe um nome de 1 a 80 caracteres.')
      await persistRenamePlaylist(playlistId, name)
      setPlaylists((current) => current.map((item) => item.id === playlistId ? { ...item, name } : item))
      setNotice('Playlist renomeada.')
    })
  }

  async function deletePlaylist(playlistId: string) {
    const playlist = playlists.find((item) => item.id === playlistId)
    if (!playlist) return false
    return mutateCatalog(async () => {
      await persistDeletePlaylist(playlistId)
      setPlaylists((current) => current.filter((item) => item.id !== playlistId))
      setActiveView((current) => current === `playlist:${playlistId}` ? 'library' : current)
      // The playing queue is a snapshot; removing a collection must not stop its media.
      setNotice('Playlist excluída. Suas músicas e vídeos foram mantidos.')
    })
  }

  async function editTrack(trackId: string, fields: { title: string; artist: string; album: string }) {
    return mutateCatalog(async () => {
      const next = { title: fields.title.trim(), artist: fields.artist.trim(), album: fields.album.trim() }
      if (!next.title || Object.values(next).some((value) => value.length > 200)) {
        throw new Error('Informe um título e use até 200 caracteres por campo.')
      }
      await persistTrackMetadata(trackId, next)
      setTracks((current) => current.map((track) => track.id === trackId ? { ...track, ...next } : track))
      setNotice('Informações atualizadas. O arquivo de mídia não foi alterado.')
    })
  }

  async function addToPlaylist(playlistId: string, trackId: string) {
    return mutateCatalog(async () => {
      await persistAddToPlaylist(playlistId, trackId)
      setPlaylists((current) => current.map((playlist) => playlist.id === playlistId && !playlist.trackIds.includes(trackId)
        ? { ...playlist, trackIds: [...playlist.trackIds, trackId] }
        : playlist))
      setNotice('Música adicionada à playlist.')
    })
  }

  async function removeFromPlaylist(playlistId: string, trackId: string) {
    return mutateCatalog(async () => {
      await persistRemoveFromPlaylist(playlistId, trackId)
      setPlaylists((current) => current.map((playlist) => playlist.id === playlistId
        ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
        : playlist))
      if (activeView === `playlist:${playlistId}`) {
        setPlaybackQueue((current) => current.filter((id) => id !== trackId))
        shuffledQueue.current = shuffledQueue.current.filter((id) => id !== trackId)
      }
      setNotice('Mídia removida da playlist e mantida na biblioteca.')
    })
  }

  async function reorderPlaylist(playlistId: string, trackIds: string[]) {
    return mutateCatalog(async () => {
      const previousOrder = playlists.find((playlist) => playlist.id === playlistId)?.trackIds
      if (!previousOrder || previousOrder.length !== trackIds.length) return
      await persistPlaylistOrder(playlistId, trackIds)
      setPlaylists((current) => current.map((playlist) => playlist.id === playlistId
        ? { ...playlist, trackIds }
        : playlist))
      if (activeView === `playlist:${playlistId}`) {
        setPlaybackQueue(trackIds)
        if (settings.shuffleEnabled) {
          shuffledQueue.current = shuffledFromCurrent(trackIds, currentTrackId)
        }
      }
      setNotice('Ordem da playlist salva.')
    })
  }

  async function saveSettings(nextSettings: AppSettings) {
    clearMessages()
    setIsBusy(true)
    try {
      setSettings(await persistSettings(nextSettings))
      setNotice('Configurações salvas neste dispositivo.')
      return true
    } catch (reason) {
      setError(errorMessage(reason))
      return false
    } finally {
      setIsBusy(false)
    }
  }

  return {
    activeView,
    addToPlaylist,
    analyzeMedia,
    cancelMediaDownload,
    clearMediaAnalysis,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    editTrack,
    isCatalogBusy,
    cycleRepeatMode,
    currentTrack,
    deleteTrack,
    downloadFromUrl,
    downloadAnalyzedMedia,
    downloadStatus,
    error,
    importBrowserFiles,
    importFromPicker,
    isBusy,
    isPlaying,
    isReady,
    mediaAnalysis,
    notice,
    onTrackEnded: handleTrackEnded,
    playNext: () => playAdjacent(1),
    playPrevious: () => playAdjacent(-1),
    playTrack,
    playlists,
    reorderPlaylist,
    removeFromPlaylist,
    saveSettings,
    setActiveView,
    setIsPlaying,
    setVolume: (volume: number) => setSettings((current) => ({ ...current, volume })),
    settings,
    toggleFavorite,
    toggleLike,
    toggleShuffle,
    tracks,
  }
}
