import { invoke } from '@tauri-apps/api/core'

export interface AudioSnapshot {
  trackId?: string
  queueIds?: string[]
  positionMs: number
  durationMs: number
  playing: boolean
  playWhenReady: boolean
  state: 'idle' | 'buffering' | 'ready' | 'ended' | 'error'
  error?: string
  repeatOne: boolean
  shuffle: boolean
}
export interface MediaDescription { id: string; hasVideo: boolean; durationMs: number; error?: string }
export interface AudioCommand {
  action: 'inspect' | 'load' | 'status' | 'play' | 'pause' | 'seek' | 'next' | 'previous' | 'options' | 'clear'
  trackIds?: string[]
  currentId?: string
  positionMs?: number
  playing?: boolean
  volume?: number
  repeatOne?: boolean
  shuffle?: boolean
  autoplay?: boolean
}
export function audioCommand<T = AudioSnapshot>(request: AudioCommand): Promise<T> {
  return invoke<T>('audio_playback', { request })
}

// Keep the original mixed-playlist order: do not silently skip videos. Native audio
// owns an entire contiguous music segment; videos retain their existing UI player.
export function audioSegment(ids: string[], currentId: string | undefined, descriptions: Record<string, MediaDescription>): string[] {
  const index = ids.indexOf(currentId ?? '')
  const audio = (id: string) => descriptions[id] && !descriptions[id].hasVideo && !descriptions[id].error
  if (index < 0 || !audio(ids[index])) return []
  let start = index
  let end = index + 1
  while (start > 0 && audio(ids[start - 1])) start--
  while (end < ids.length && audio(ids[end])) end++
  return ids.slice(start, end)
}
