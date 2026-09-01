import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  analyzeExternalMedia,
  bootstrapLibrary,
  cancelExternalDownload,
  chooseAndImportTracks,
  defaultSettings,
  downloadDirectTrack,
  downloadExternalMedia,
  hydrateTrack,
  importNativePaths,
  listenForNativeDrops,
  persistAddToPlaylist,
  persistPlaylist,
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

export function useLibrary() {
  const [tracks, setTracks] = useState<MediaTrack[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [activeView, setActiveView] = useState<LibraryView>('home')
  const [currentTrackId, setCurrentTrackId] = useState<string>()
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

  useEffect(() => {
    void bootstrapLibrary()
      .then((snapshot) => {
        setTracks(snapshot.tracks)
        setPlaylists(snapshot.playlists)
        setSettings(snapshot.settings)
        setCurrentTrackId(snapshot.tracks[0]?.id)
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
    setIsPlaying(true)
    setActiveView('downloads')
    setNotice(`${imported.length} ${imported.length === 1 ? 'música adicionada' : 'músicas adicionadas'} à biblioteca ♡`)
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

  function playTrack(trackId: string) {
    if (trackId === currentTrackId) {
      setIsPlaying((playing) => !playing)
      return
    }
    setCurrentTrackId(trackId)
    setIsPlaying(true)
  }

  function playAdjacent(direction: 1 | -1) {
    if (tracks.length === 0) return
    const currentIndex = Math.max(0, tracks.findIndex((track) => track.id === currentTrackId))
    const nextIndex = (currentIndex + direction + tracks.length) % tracks.length
    setCurrentTrackId(tracks[nextIndex].id)
    setIsPlaying(true)
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
      setNotice('Link analisado. Agora escolha o formato que você quer ♡')
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
        message: 'Download concluído e adicionado à biblioteca ♡',
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
        message: 'Prontinho! Já está na biblioteca ♡',
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

  async function createPlaylist(name: string) {
    clearMessages()
    try {
      const playlist = await persistPlaylist(name.trim())
      setPlaylists((current) => [...current, playlist])
      setActiveView(`playlist:${playlist.id}`)
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  async function addToPlaylist(playlistId: string, trackId: string) {
    setPlaylists((current) => current.map((playlist) => playlist.id === playlistId && !playlist.trackIds.includes(trackId)
      ? { ...playlist, trackIds: [...playlist.trackIds, trackId] }
      : playlist))
    try {
      await persistAddToPlaylist(playlistId, trackId)
      setNotice('Música adicionada à playlist ♡')
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  async function removeFromPlaylist(playlistId: string, trackId: string) {
    setPlaylists((current) => current.map((playlist) => playlist.id === playlistId
      ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
      : playlist))
    try {
      await persistRemoveFromPlaylist(playlistId, trackId)
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  async function saveSettings(nextSettings: AppSettings) {
    clearMessages()
    setIsBusy(true)
    try {
      setSettings(await persistSettings(nextSettings))
      setNotice('Configurações salvas neste dispositivo ♡')
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
    currentTrack,
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
    playNext: () => playAdjacent(1),
    playPrevious: () => playAdjacent(-1),
    playTrack,
    playlists,
    removeFromPlaylist,
    saveSettings,
    setActiveView,
    setIsPlaying,
    setVolume: (volume: number) => setSettings((current) => ({ ...current, volume })),
    settings,
    toggleFavorite,
    toggleLike,
    tracks,
  }
}
