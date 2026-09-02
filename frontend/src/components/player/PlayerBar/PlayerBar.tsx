import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
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

export function PlayerBar({
  isPlaying,
  repeatMode,
  shuffleEnabled,
  track,
  volume,
  onNext,
  onPrevious,
  onRepeatChange,
  onShuffleChange,
  onTrackEnded,
  onToggle,
  onToggleLike,
  onVolumeChange,
}: PlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track?.fileUrl) return

    audio.src = track.fileUrl
    audio.load()
    setCurrentTime(0)
  }, [track?.fileUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track?.fileUrl) return
    if (isPlaying) {
      void audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }, [isPlaying, track?.fileUrl])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  if (!track) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <footer className="player-bar">
      <audio
        ref={audioRef}
        loop={repeatMode === 'one'}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={onTrackEnded}
      />
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
            <span className="sr-only">Posição da música</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={duration ? currentTime : progress}
              onChange={(event) => {
                const value = Number(event.target.value)
                setCurrentTime(value)
                if (audioRef.current && duration) audioRef.current.currentTime = value
              }}
              style={{ '--progress': `${progress}%` } as CSSProperties}
            />
          </label>
          <span>{duration ? formatTime(duration) : track.durationLabel}</span>
        </div>
      </div>

      <div className="player-extras">
        <button type="button" aria-label="Fila de reprodução"><ListMusic size={16} /></button>
        <Volume2 size={16} />
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
  )
}
