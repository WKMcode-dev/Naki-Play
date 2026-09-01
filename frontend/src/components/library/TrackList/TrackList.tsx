import { useState } from 'react'
import { Heart, ListMinus, ListPlus, MoreHorizontal, Pause, Play, Sparkles } from 'lucide-react'
import type { MediaTrack, Playlist } from '../../../types/library'
import './TrackList.css'

interface TrackListProps {
  currentTrackId?: string
  currentPlaylistId?: string
  emptyMessage?: string
  isPlaying: boolean
  tracks: MediaTrack[]
  playlists: Playlist[]
  onAddToPlaylist: (playlistId: string, trackId: string) => void
  onPlay: (trackId: string) => void
  onToggleFavorite: (trackId: string) => void
  onToggleLike: (trackId: string) => void
  onRemoveFromPlaylist?: (playlistId: string, trackId: string) => void
}

export function TrackList({
  currentTrackId,
  currentPlaylistId,
  emptyMessage = 'Nenhuma música por aqui ainda.',
  isPlaying,
  tracks,
  playlists,
  onAddToPlaylist,
  onPlay,
  onToggleFavorite,
  onToggleLike,
  onRemoveFromPlaylist,
}: TrackListProps) {
  const [openMenu, setOpenMenu] = useState<string>()

  if (tracks.length === 0) {
    return <div className="track-list__empty">♡<span>{emptyMessage}</span></div>
  }

  return (
    <div className="track-list">
      <div className="track-list__header" aria-hidden="true">
        <span>Música</span>
        <span>Álbum</span>
        <span>Tempo</span>
        <span />
      </div>
      {tracks.map((track) => {
        const isCurrent = currentTrackId === track.id
        return (
          <div className={`track-row ${isCurrent ? 'track-row--current' : ''}`} key={track.id}>
            <button className="track-row__main" type="button" onClick={() => onPlay(track.id)}>
              <span className="track-cover" style={{ background: track.cover }}>
                <span className="track-cover__play">
                  {isCurrent && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                </span>
                <span className="track-cover__letter">{track.title.charAt(0)}</span>
              </span>
              <span className="track-row__identity">
                <strong>{track.title}</strong>
                <small>{track.artist}{track.fileName ? ` · ${track.fileName.split('.').pop()?.toUpperCase()}` : ''}</small>
              </span>
            </button>
            <span className="track-row__album">{track.album}</span>
            <span className="track-row__duration">{track.durationLabel}</span>
            <span className="track-row__actions">
              <button
                className={track.isLiked ? 'is-marked' : ''}
                type="button"
                aria-label={track.isLiked ? 'Remover das gostadas' : 'Marcar como gostada'}
                onClick={() => onToggleLike(track.id)}
              >
                <Heart size={15} fill={track.isLiked ? 'currentColor' : 'none'} />
              </button>
              <button
                className={track.isFavorite ? 'is-marked' : ''}
                type="button"
                aria-label={track.isFavorite ? 'Remover das favoritas' : 'Adicionar às favoritas'}
                onClick={() => onToggleFavorite(track.id)}
              >
                <Sparkles size={15} fill={track.isFavorite ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                aria-label="Mais opções"
                onClick={() => setOpenMenu((current) => current === track.id ? undefined : track.id)}
              >
                <MoreHorizontal size={17} />
              </button>
            </span>
            {openMenu === track.id && (
              <div className="track-menu">
                <strong>Playlists</strong>
                {playlists.length === 0 && <small>Crie uma playlist primeiro.</small>}
                {playlists.map((playlist) => {
                  const alreadyAdded = playlist.trackIds.includes(track.id)
                  return (
                    <button
                      key={playlist.id}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => {
                        onAddToPlaylist(playlist.id, track.id)
                        setOpenMenu(undefined)
                      }}
                    >
                      <ListPlus size={14} />
                      <span>{playlist.name}</span>
                      {alreadyAdded && <small>já adicionada</small>}
                    </button>
                  )
                })}
                {currentPlaylistId && onRemoveFromPlaylist && (
                  <button
                    className="track-menu__remove"
                    type="button"
                    onClick={() => {
                      onRemoveFromPlaylist(currentPlaylistId, track.id)
                      setOpenMenu(undefined)
                    }}
                  >
                    <ListMinus size={14} /> Remover desta playlist
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
