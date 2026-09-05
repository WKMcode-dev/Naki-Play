import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Heart,
  ListMusic,
  Maximize2,
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  VolumeX,
  Volume2,
} from 'lucide-react'
import type { MediaTrack, RepeatMode } from '../../../types/library'
import './PlayerBar.css'

interface PlayerBarProps {
  isPlaying: boolean
  repeatMode: RepeatMode
  shuffleEnabled: boolean
  track?: MediaTrack
  volume: number
  onNext: () => void
  onPlaybackError: () => void
  onPrevious: () => void
  onRepeatChange: () => void
  onShuffleChange: () => void
  onTrackEnded: () => void
  onToggle: () => void
  onToggleLike: (trackId: string) => void
  onVolumeChange: (volume: number) => void
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function isVideoTrack(track?: MediaTrack) {
  return [track?.fileName, track?.filePath, track?.fileUrl]
    .filter((source): source is string => Boolean(source))
    .some((source) => /\.(mp4|webm|mov)(?:$|[?#])/i.test(source))
}

export function PlayerBar({
  isPlaying,
  repeatMode,
  shuffleEnabled,
  track,
  volume,
  onNext,
  onPlaybackError,
  onPrevious,
  onRepeatChange,
  onShuffleChange,
  onTrackEnded,
  onToggle,
  onToggleLike,
  onVolumeChange,
}: PlayerBarProps) {
  const mediaRef = useRef<HTMLMediaElement>(null)
  const videoStageRef = useRef<HTMLDivElement>(null)
  const lastAudibleVolume = useRef(volume > 0 ? volume : 0.82)
  const playbackErrorHandler = useRef(onPlaybackError)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [mediaError, setMediaError] = useState<string>()
  const showsVideo = isVideoTrack(track)

  useEffect(() => {
    playbackErrorHandler.current = onPlaybackError
  }, [onPlaybackError])

  useEffect(() => {
    const media = mediaRef.current
    if (!media || !track?.fileUrl) return

    media.src = track.fileUrl
    media.load()
    setCurrentTime(0)
    setDuration(0)
    setMediaError(undefined)

    return () => {
      media.pause()
      media.removeAttribute('src')
      media.load()
    }
  }, [showsVideo, track?.fileUrl])

  useEffect(() => {
    const media = mediaRef.current
    if (!media || !track?.fileUrl) return
    if (volume > 0) lastAudibleVolume.current = volume
    media.volume = volume
    media.muted = volume === 0
  }, [showsVideo, track?.fileUrl, volume])

  useEffect(() => {
    const media = mediaRef.current
    if (!media || !track?.fileUrl) return
    let cancelled = false
    if (isPlaying) {
      void media.play().catch(() => {
        if (cancelled || mediaRef.current !== media) return
        setMediaError('Não foi possível reproduzir este formato de mídia.')
        playbackErrorHandler.current()
      })
    } else {
      media.pause()
    }
    return () => {
      cancelled = true
    }
  }, [isPlaying, showsVideo, track?.fileUrl])

  function toggleMuted() {
    onVolumeChange(volume > 0 ? 0 : lastAudibleVolume.current)
  }

  async function openFullscreen() {
    const stage = videoStageRef.current
    if (!stage?.requestFullscreen) {
      setMediaError('A tela cheia não está disponível neste dispositivo.')
      return
    }
    try {
      await stage.requestFullscreen()
    } catch {
      setMediaError('Não foi possível abrir o vídeo em tela cheia.')
    }
  }

  if (!track) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <>
      {showsVideo && (
        <div className="player-video-stage" ref={videoStageRef}>
          <video
            ref={(element) => { mediaRef.current = element }}
            loop={repeatMode === 'one'}
            playsInline
            preload="metadata"
            onCanPlay={() => setMediaError(undefined)}
            onEnded={onTrackEnded}
            onError={() => setMediaError('Este vídeo usa um formato que o dispositivo não conseguiu abrir.')}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          />
          {!isPlaying && (
            <button className="player-video-stage__toggle" type="button" aria-label="Reproduzir vídeo" onClick={onToggle}>
              <Play size={34} fill="currentColor" />
            </button>
          )}
          <div className="player-video-stage__controls">
            <button type="button" aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'} onClick={onToggle}>
              {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            </button>
            <label>
              <span className="sr-only">Posição da reprodução do vídeo</span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={duration ? currentTime : 0}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setCurrentTime(value)
                  if (mediaRef.current && duration) mediaRef.current.currentTime = value
                }}
              />
            </label>
            <button type="button" aria-label={volume > 0 ? 'Silenciar vídeo' : 'Restaurar volume do vídeo'} onClick={toggleMuted}>
              {volume > 0 ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button type="button" aria-label="Exibir vídeo em tela cheia" onClick={() => void openFullscreen()}>
              <Maximize2 size={17} />
            </button>
          </div>
          {mediaError && <span className="player-video-stage__error" role="alert">{mediaError}</span>}
        </div>
      )}
      <footer className="player-bar">
      {!showsVideo && (
        <audio
          ref={(element) => { mediaRef.current = element }}
          loop={repeatMode === 'one'}
          preload="metadata"
          onCanPlay={() => setMediaError(undefined)}
          onEnded={onTrackEnded}
          onError={() => setMediaError('Não foi possível reproduzir este arquivo de áudio.')}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        />
      )}
      {mediaError && !showsVideo && <span className="player-media-error" role="alert">{mediaError}</span>}
      <div className="player-track">
        <span className="player-track__cover" style={{ background: track.cover }}>{track.title.charAt(0)}</span>
        <span className="player-track__copy">
          <strong>{track.title}</strong>
          <small>{track.artist}</small>
        </span>
        <button
          className={track.isLiked ? 'player-like player-like--active' : 'player-like'}
          type="button"
          aria-label={track.isLiked ? 'Remover das gostadas' : 'Marcar como gostada'}
          onClick={() => onToggleLike(track.id)}
        >
          <Heart size={16} fill={track.isLiked ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button
            className={shuffleEnabled ? 'player-control--active' : ''}
            type="button"
            aria-label={shuffleEnabled ? 'Desativar ordem aleatória' : 'Ativar ordem aleatória'}
            aria-pressed={shuffleEnabled}
            title={shuffleEnabled ? 'Aleatório ativado' : 'Aleatório desativado'}
            onClick={onShuffleChange}
          >
            <Shuffle size={14} />
          </button>
          <button type="button" aria-label="Faixa anterior" onClick={onPrevious}><SkipBack size={16} fill="currentColor" /></button>
          <button className="player-controls__main" type="button" aria-label={isPlaying ? 'Pausar' : 'Tocar'} onClick={onToggle}>
            {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          </button>
          <button type="button" aria-label="Próxima faixa" onClick={onNext}><SkipForward size={16} fill="currentColor" /></button>
          <button
            className={repeatMode === 'one' ? 'player-control--active player-control--repeat' : 'player-control--repeat'}
            type="button"
            aria-label={repeatMode === 'one' ? 'Desativar repetição da música' : 'Repetir música atual'}
            aria-pressed={repeatMode === 'one'}
            title={repeatMode === 'one' ? 'Repetindo a música atual' : 'Repetir música atual'}
            onClick={onRepeatChange}
          >
            <Repeat2 size={15} />
            {repeatMode === 'one' && <small>1</small>}
          </button>
        </div>
        <div className="player-progress">
          <span>{formatTime(currentTime)}</span>
          <label>
            <span className="sr-only">Posição da reprodução</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={duration ? currentTime : progress}
              onChange={(event) => {
                const value = Number(event.target.value)
                setCurrentTime(value)
                if (mediaRef.current && duration) mediaRef.current.currentTime = value
              }}
              style={{ '--progress': `${progress}%` } as CSSProperties}
            />
          </label>
          <span>{duration ? formatTime(duration) : track.durationLabel}</span>
        </div>
      </div>

      <div className="player-extras">
        <button type="button" aria-label="Fila de reprodução"><ListMusic size={16} /></button>
        <button type="button" aria-label={volume > 0 ? 'Silenciar' : 'Restaurar volume'} aria-pressed={volume === 0} onClick={toggleMuted}>
          {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <input
          className="volume-input"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          aria-label="Volume"
          onChange={(event) => onVolumeChange(Number(event.target.value))}
        />
      </div>
      </footer>
    </>
  )
}
