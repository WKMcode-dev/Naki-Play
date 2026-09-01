import { Channel, convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import type {
  AppSettings,
  AppSnapshot,
  ExternalMediaAnalysis,
  MediaTrack,
  NativeDownloadEvent,
  Playlist,
} from '../types/library'

const coverGradients = [
  'linear-gradient(145deg, #7c3a75 0%, #d2699e 55%, #f7c6cf 100%)',
  'linear-gradient(145deg, #f2afc1 0%, #ca739f 48%, #65406f 100%)',
  'linear-gradient(145deg, #f7e9df 0%, #efb6bd 52%, #b66f8c 100%)',
  'linear-gradient(145deg, #392b4b 0%, #76527c 48%, #d49ab1 100%)',
  'linear-gradient(145deg, #f4c8d4 0%, #ba6b94 52%, #5d345d 100%)',
  'linear-gradient(145deg, #eaddeb 0%, #a975a9 48%, #4e365d 100%)',
  'linear-gradient(145deg, #fde5dc 0%, #e89aaa 52%, #944e76 100%)',
  'linear-gradient(145deg, #6e486d 0%, #9e7199 45%, #e7b4c5 100%)',
]

export const defaultSettings: AppSettings = {
  userName: 'Meu amor',
  appTitle: 'Naki',
  themeMode: 'system',
  primaryColor: '#60354f',
  accentColor: '#b75f8b',
  lightBackground: '#fbf9f7',
  darkBackground: '#171218',
  reduceMotion: false,
  compactMode: false,
  autoplay: false,
  volume: 0.82,
}

export function runningInTauri() {
  return isTauri()
}

export function runningOnAndroid() {
  return runningInTauri() && navigator.userAgent.toLocaleLowerCase().includes('android')
}

export function mediaEngineAvailable() {
  if (!runningInTauri()) return false
  const userAgent = navigator.userAgent.toLocaleLowerCase()
  return userAgent.includes('android') || userAgent.includes('windows')
}

function durationLabel(seconds: number) {
  if (!seconds) return '—:—'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

export function hydrateTrack(track: MediaTrack): MediaTrack {
  const seed = Math.abs(track.coverSeed ?? 0) % coverGradients.length
  return {
    ...track,
    durationSeconds: track.durationSeconds ?? 0,
    durationLabel: durationLabel(track.durationSeconds ?? 0),
    cover: coverGradients[seed],
    fileUrl: track.filePath && runningInTauri() ? convertFileSrc(track.filePath) : track.fileUrl,
  }
}

function browserSnapshot(): AppSnapshot {
  const storedSettings = window.localStorage.getItem('naki-play:settings')
  let settings = defaultSettings
  if (storedSettings) {
    try {
      settings = { ...defaultSettings, ...JSON.parse(storedSettings) as AppSettings }
    } catch {
      window.localStorage.removeItem('naki-play:settings')
    }
  }
  return { settings, tracks: [], playlists: [] }
}

export async function bootstrapLibrary(): Promise<AppSnapshot> {
  if (!runningInTauri()) return browserSnapshot()
  const snapshot = await invoke<AppSnapshot>('bootstrap_library')
  return {
    ...snapshot,
    tracks: snapshot.tracks.map(hydrateTrack),
  }
}

function nameFromPath(path: string) {
  const part = path.split(/[\\/]/).pop() ?? ''
  try {
    return decodeURIComponent(part.split('?')[0])
  } catch {
    return part.split('?')[0]
  }
}

export async function chooseAndImportTracks(): Promise<MediaTrack[]> {
  if (!runningInTauri()) return []
  const selected = await open({
    multiple: true,
    directory: false,
    title: 'Escolha suas músicas',
    filters: [{
      name: 'Áudio e vídeo',
      extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'mp4', 'webm', 'mov'],
    }],
  })
  const paths = selected === null ? [] : Array.isArray(selected) ? selected : [selected]
  if (paths.length === 0) return []
  const tracks = await invoke<MediaTrack[]>('import_tracks', {
    items: paths.map((path) => ({ path, name: nameFromPath(path) })),
  })
  return tracks.map(hydrateTrack)
}

export async function importNativePaths(paths: string[]): Promise<MediaTrack[]> {
  if (!runningInTauri() || paths.length === 0) return []
  const tracks = await invoke<MediaTrack[]>('import_tracks', {
    items: paths.map((path) => ({ path, name: nameFromPath(path) })),
  })
  return tracks.map(hydrateTrack)
}

export async function listenForNativeDrops(
  onDrop: (paths: string[]) => void | Promise<void>,
) {
  if (!runningInTauri()) return () => undefined
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow().onDragDropEvent((event) => {
    if (event.payload.type === 'drop') void onDrop(event.payload.paths)
  })
}

export async function downloadDirectTrack(url: string): Promise<MediaTrack> {
  if (!runningInTauri()) {
    throw new Error('Downloads persistentes funcionam no aplicativo instalado para desktop ou Android.')
  }
  return hydrateTrack(await invoke<MediaTrack>('download_track_from_url', { url }))
}

export async function analyzeExternalMedia(url: string): Promise<ExternalMediaAnalysis> {
  if (!mediaEngineAvailable()) {
    throw new Error('A análise de links funciona no aplicativo instalado para Android ou Windows.')
  }
  return invoke<ExternalMediaAnalysis>('analyze_external_media', { url })
}

interface ExternalMediaDownloadRequest {
  analysis: ExternalMediaAnalysis
  optionId: string
  jobId: string
  confirmedAuthorized: boolean
}

export async function downloadExternalMedia(
  request: ExternalMediaDownloadRequest,
  onProgress: (event: NativeDownloadEvent) => void,
): Promise<MediaTrack> {
  if (!mediaEngineAvailable()) {
    throw new Error('Downloads e conversões funcionam no aplicativo instalado para Android ou Windows.')
  }
  const onEvent = new Channel<NativeDownloadEvent>()
  onEvent.onmessage = onProgress
  const track = await invoke<MediaTrack>('download_external_media', {
    selection: {
      url: request.analysis.webpageUrl,
      optionId: request.optionId,
      title: request.analysis.title,
      author: request.analysis.author,
      durationSeconds: request.analysis.durationSeconds,
      provider: request.analysis.provider,
      jobId: request.jobId,
      confirmedAuthorized: request.confirmedAuthorized,
    },
    onEvent,
  })
  return hydrateTrack(track)
}

export async function cancelExternalDownload(jobId: string): Promise<boolean> {
  if (!mediaEngineAvailable()) return false
  return invoke<boolean>('cancel_external_download', { jobId })
}

export async function persistTrackFlag(
  command: 'set_track_liked' | 'set_track_favorite',
  trackId: string,
  value: boolean,
) {
  if (runningInTauri()) await invoke(command, { trackId, value })
}

export async function persistSettings(settings: AppSettings): Promise<AppSettings> {
  if (!runningInTauri()) {
    window.localStorage.setItem('naki-play:settings', JSON.stringify(settings))
    return settings
  }
  return invoke<AppSettings>('save_settings', { settings })
}

export async function persistPlaylist(name: string): Promise<Playlist> {
  if (!runningInTauri()) {
    return { id: crypto.randomUUID(), name, trackIds: [] }
  }
  return invoke<Playlist>('create_playlist', { name })
}

export async function persistAddToPlaylist(playlistId: string, trackId: string) {
  if (runningInTauri()) await invoke('add_track_to_playlist', { playlistId, trackId })
}

export async function persistRemoveFromPlaylist(playlistId: string, trackId: string) {
  if (runningInTauri()) await invoke('remove_track_from_playlist', { playlistId, trackId })
}
