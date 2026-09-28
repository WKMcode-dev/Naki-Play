import { useCallback, useEffect, useRef, useState } from 'react'
import { runningOnAndroid } from '../services/nativeLibrary'
import { audioCommand, audioSegment, type AudioCommand, type AudioSnapshot, type MediaDescription } from '../services/nativeAudio'
import type { AppSettings, MediaTrack } from '../types/library'

interface Options {
  tracks: MediaTrack[]
  queueIds: string[]
  currentId?: string
  playing: boolean
  libraryReady: boolean
  settings: AppSettings
  onTrack: (id: string | undefined) => void
  onPlaying: (value: boolean) => void
  onQueue: (ids: string[]) => void
}

export function useAndroidAudio(options: Options) {
  const enabled = runningOnAndroid()
  const latest = useRef(options)
  latest.current = options
  const [descriptions, setDescriptions] = useState<Record<string, MediaDescription>>({})
  const [ready, setReady] = useState(false)
  // Progress belongs to the player bar, not the whole library. Notify its external
  // store subscriber without rendering every track/playlist once per poll.
  const snapshot = useRef<AudioSnapshot | undefined>(undefined)
  const subscribers = useRef(new Set<() => void>())
  const setSnapshot = useCallback((value: AudioSnapshot | undefined) => {
    snapshot.current = value
    subscribers.current.forEach(notify => notify())
  }, [])
  const subscribe = useCallback((notify: () => void) => {
    subscribers.current.add(notify)
    return () => { subscribers.current.delete(notify) }
  }, [])
  const getSnapshot = useCallback(() => snapshot.current, [])
  const [error, setError] = useState<string>()
  const [applied, setApplied] = useState('')
  const serial = useRef(Promise.resolve())
  const pending = useRef(0)
  const generation = useRef(0)
  const ending = useRef('')
  const previousLoad = useRef<{ currentId?: string; playing: boolean } | undefined>(undefined)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const run = useCallback((request: AudioCommand): Promise<AudioSnapshot> => {
    pending.current++
    const result = serial.current.then(() => audioCommand(request))
    serial.current = result.then(() => undefined, () => undefined)
    return result.finally(() => { pending.current-- })
  }, [])

  // Reattach before sending the initial catalog selection, so opening the UI does
  // not overwrite music that is already playing in the service with screen off.
  useEffect(() => {
    if (!enabled || !options.libraryReady) return
    let cancelled = false
    void run({ action: 'status' }).then((status) => {
      if (cancelled) return
      if (status.trackId && latest.current.tracks.some(t => t.id === status.trackId) && status.state !== 'idle') {
        const existingIds = new Set(latest.current.tracks.map(t => t.id))
        const queue = status.queueIds?.filter(id => existingIds.has(id))
        if (queue?.length) latest.current.onQueue(queue)
        latest.current.onTrack(status.trackId)
        latest.current.onPlaying(status.playWhenReady && !['ended', 'error'].includes(status.state))
        setSnapshot(status)
      }
      setReady(true)
    }).catch(reason => { if (!cancelled) { setError(String(reason)); setReady(true) } })
    return () => { cancelled = true }
  }, [enabled, options.libraryReady, run, setSnapshot])

  const catalogKey = JSON.stringify(options.tracks.map(t => [t.id, t.filePath]))
  useEffect(() => {
    if (!enabled || !options.libraryReady) return
    let cancelled = false
    const ids = latest.current.tracks.map(t => t.id)
    void (async () => {
      const found: Record<string, MediaDescription> = {}
      for (let offset = 0; offset < ids.length; offset += 32) {
        if (cancelled) return
        const batch = ids.slice(offset, offset + 32)
        try {
          const result = await audioCommand<{ items: MediaDescription[] }>({ action: 'inspect', trackIds: batch })
          result.items.forEach(item => { found[item.id] = item })
        } catch {
          // One stale/deleted file must not prevent inspecting all other tracks.
          for (const id of batch) {
            if (cancelled) return
            try {
              const result = await audioCommand<{ items: MediaDescription[] }>({ action: 'inspect', trackIds: [id] })
              result.items.forEach(item => { found[item.id] = item })
            } catch (reason) { found[id] = { id, hasVideo: false, durationMs: 0, error: String(reason) } }
          }
        }
      }
      if (!cancelled) setDescriptions(found)
    })()
    return () => { cancelled = true }
  }, [enabled, options.libraryReady, catalogKey])

  const ids = options.queueIds.filter(id => options.tracks.some(t => t.id === id))
  if (options.currentId && !ids.includes(options.currentId)) ids.unshift(options.currentId)
  const segment = audioSegment(ids, options.currentId, descriptions)
  const description = descriptions[options.currentId ?? '']
  const active = enabled && Boolean(options.currentId) && !description?.hasVideo
  const desired = active ? JSON.stringify({
    ids: segment, current: options.currentId, playing: options.playing,
    video: description?.hasVideo, known: Boolean(description),
    error: description?.error,
    volume: options.settings.volume, repeat: options.settings.repeatMode === 'one',
    shuffle: options.settings.shuffleEnabled, autoplay: options.settings.autoplay,
    metadata: options.tracks.filter(t => segment.includes(t.id)).map(t => [t.id, t.title, t.artist]),
  }) : JSON.stringify({ html: options.currentId ?? null, known: Boolean(description) })
  const latestDesired = useRef(desired)
  latestDesired.current = desired
  const currentSegment = useRef(segment)
  currentSegment.current = segment

  const accept = useCallback((status: AudioSnapshot) => {
    if (!mounted.current) return
    setSnapshot(status)
    setError(status.error || undefined)
    if (status.trackId && currentSegment.current.includes(status.trackId)) {
      latest.current.onTrack(status.trackId)
      latest.current.onPlaying(status.playWhenReady && !['ended', 'error'].includes(status.state))
    }
  }, [setSnapshot])

  useEffect(() => {
    if (!enabled || !ready || (options.currentId && !description)) return
    const token = ++generation.current
    const previous = previousLoad.current
    const request: AudioCommand = active && segment.length && !description?.error ? {
      action: 'load', trackIds: segment,
      // An options/catalog update must not rewind a service that just auto-advanced.
      currentId: previous?.currentId === options.currentId ? undefined : options.currentId,
      playing: previous?.playing === options.playing ? undefined : options.playing,
      volume: options.settings.volume, repeatOne: options.settings.repeatMode === 'one',
      shuffle: options.settings.shuffleEnabled, autoplay: options.settings.autoplay,
    } : { action: 'clear' }
    void run(request).then(status => {
      if (!mounted.current || token !== generation.current || latestDesired.current !== desired) return
      previousLoad.current = request.action === 'load' ? { currentId: options.currentId, playing: options.playing } : undefined
      setApplied(desired)
      if (request.action !== 'clear') accept(status)
      else {
        setSnapshot(undefined); setError(description?.error)
        if (description?.error) latest.current.onPlaying(false)
      }
    }).catch(reason => {
      if (!mounted.current || token !== generation.current || latestDesired.current !== desired) return
      previousLoad.current = undefined
      setError(String(reason)); setApplied(desired); latest.current.onPlaying(false)
    })
  // The serialized desired state deliberately excludes progress, avoiding resets.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ready, desired, run, accept])

  useEffect(() => {
    if (!enabled || !ready) return
    let disposed = false
    let polling = false
    const poll = async () => {
      if (disposed || polling || pending.current || document.hidden || !latest.current.currentId) return
      polling = true
      const token = generation.current
      const desiredAtStart = latestDesired.current
      try {
        const status = await audioCommand({ action: 'status' })
        if (disposed || pending.current || token !== generation.current || desiredAtStart !== latestDesired.current || !currentSegment.current.includes(status.trackId ?? '')) return
        if (status.state === 'ended' && latest.current.settings.autoplay && latest.current.settings.repeatMode !== 'one') {
          const queue = latest.current.queueIds
          const next = queue[queue.indexOf(status.trackId ?? '') + 1]
          const key = `${status.trackId}:${next}`
          if (next && descriptions[next]?.hasVideo && ending.current !== key) {
            ending.current = key
            latest.current.onTrack(next); latest.current.onPlaying(true)
            return
          }
        } else { ending.current = '' }
        accept(status)
      } catch (reason) { if (!disposed) setError(String(reason)) }
      finally { polling = false }
    }
    const timer = window.setInterval(() => void poll(), 750)
    const onVisibility = () => void poll()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { disposed = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [enabled, ready, descriptions, accept])

  const command = async (request: AudioCommand) => {
    const desiredAtStart = latestDesired.current
    try {
      const status = await run(request)
      if (desiredAtStart === latestDesired.current) accept(status)
    } catch (reason) {
      if (desiredAtStart === latestDesired.current) { setError(String(reason)); latest.current.onPlaying(false) }
    }
  }

  return {
    enabled, active, hasVideo: description?.hasVideo ?? false,
    waiting: enabled && (!ready || Boolean(options.currentId && !description) || applied !== desired),
    error, get snapshot() { return snapshot.current }, subscribe, getSnapshot,
    seek: (seconds: number) => void command({ action: 'seek', positionMs: Math.max(0, Math.round(seconds * 1000)) }),
    adjacent: (direction: 1 | -1) => {
      if (!active || segment.length < 2) return false
      const index = segment.indexOf(options.currentId ?? '')
      if (!options.settings.shuffleEnabled && (direction === 1 ? index === segment.length - 1 : index === 0)) return false
      void command({ action: direction === 1 ? 'next' : 'previous' })
      return true
    },
    releaseTrack: async (id: string) => {
      if (!enabled || !segment.includes(id)) return
      if (id === options.currentId) { await run({ action: 'clear' }); previousLoad.current = undefined }
      else await run({ action: 'load', trackIds: segment.filter(value => value !== id), currentId: options.currentId })
    },
  }
}
