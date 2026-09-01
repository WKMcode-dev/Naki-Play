export type TrackSource = 'local' | 'direct' | 'youtube' | 'spotify'

export type LibraryView =
  | 'home'
  | 'library'
  | 'liked'
  | 'favorites'
  | 'downloads'
  | 'settings'
  | `playlist:${string}`

export interface MediaTrack {
  id: string
  title: string
  artist: string
  album: string
  durationLabel: string
  durationSeconds: number
  source: TrackSource
  sourceUrl?: string
  isLiked: boolean
  isFavorite: boolean
  cover: string
  coverSeed: number
  filePath?: string
  fileUrl?: string
  fileName: string
}

export interface Playlist {
  id: string
  name: string
  trackIds: string[]
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface AppSettings {
  userName: string
  appTitle: string
  themeMode: ThemeMode
  primaryColor: string
  accentColor: string
  lightBackground: string
  darkBackground: string
  reduceMotion: boolean
  compactMode: boolean
  autoplay: boolean
  volume: number
}

export interface AppSnapshot {
  settings: AppSettings
  tracks: MediaTrack[]
  playlists: Playlist[]
}

export interface MediaFormatChoice {
  id: string
  kind: 'audio' | 'video'
  container: 'mp3' | 'mp4'
  quality: string
  label: string
}

export interface ExternalMediaAnalysis {
  id: string
  title: string
  author: string
  thumbnailUrl?: string
  durationSeconds: number
  webpageUrl: string
  provider: string
  formats: MediaFormatChoice[]
}

export type NativeDownloadEvent =
  | { event: 'preparing'; data: { message: string } }
  | { event: 'progress'; data: { progress: number; etaSeconds: number; message: string } }
  | { event: 'converting'; data: { message: string } }
  | { event: 'finished'; data: { filePath: string } }

export type MediaDownloadStage = 'idle' | 'preparing' | 'downloading' | 'converting' | 'finished' | 'cancelling'

export interface MediaDownloadStatus {
  stage: MediaDownloadStage
  progress: number
  etaSeconds?: number
  message?: string
  jobId?: string
}
