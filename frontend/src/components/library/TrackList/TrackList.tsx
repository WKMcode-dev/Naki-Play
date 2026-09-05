import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowDownAZ, ArrowUpAZ, GripVertical, Heart, ListMinus, ListPlus, MoreHorizontal, Pause, Play, Sparkles, Trash2 } from 'lucide-react'
import type { MediaTrack, Playlist } from '../../../types/library'
import './TrackList.css'

interface TrackListProps {
  currentTrackId?: string
  currentPlaylistId?: string
  emptyMessage?: string
  isPlaying: boolean
  tracks: MediaTrack[]
  playlists: Playlist[]
  playlistTracks?: MediaTrack[]
  onAddToPlaylist: (playlistId: string, trackId: string) => void
  onDeleteTrack: (trackId: string) => void | Promise<void>
  onPlay: (trackId: string) => void
  onToggleFavorite: (trackId: string) => void
  onToggleLike: (trackId: string) => void
  onRemoveFromPlaylist?: (playlistId: string, trackId: string) => void
  onReorderPlaylist?: (trackIds: string[]) => void
}

type DropPlacement = 'before' | 'after'

interface DragState {
  draggedId: string
  placement: DropPlacement
  targetId: string
}

export function TrackList({
  currentTrackId,
  currentPlaylistId,
  emptyMessage = 'Nenhuma música por aqui ainda.',
  isPlaying,
  tracks,
  playlists,
  playlistTracks,
  onAddToPlaylist,
  onDeleteTrack,
  onPlay,
  onToggleFavorite,
  onToggleLike,
  onRemoveFromPlaylist,
  onReorderPlaylist,
}: TrackListProps) {
  const [openMenu, setOpenMenu] = useState<string>()
  const [dragState, setDragState] = useState<DragState>()
  const dragStateRef = useRef<DragState | undefined>(undefined)

  const canReorder = Boolean(currentPlaylistId && playlistTracks && onReorderPlaylist)

  function commitOrder(nextOrder: string[]) {
    if (nextOrder.length > 1) onReorderPlaylist?.(nextOrder)
  }

  function moveTrack(draggedId: string, targetId: string, placement: DropPlacement) {
    if (!playlistTracks || draggedId === targetId) return
    const nextOrder = playlistTracks.map((track) => track.id).filter((trackId) => trackId !== draggedId)
    const targetIndex = nextOrder.indexOf(targetId)
    if (targetIndex < 0) return
    nextOrder.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, draggedId)
    commitOrder(nextOrder)
  }

  function startDragging(event: ReactPointerEvent<HTMLButtonElement>, trackId: string) {
    if (!canReorder || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const nextState = { draggedId: trackId, targetId: trackId, placement: 'before' as const }
    dragStateRef.current = nextState
    setDragState(nextState)
  }

  function updateDragging(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragStateRef.current) return
    event.preventDefault()
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const row = element?.closest<HTMLElement>('[data-track-id]')
    const targetId = row?.dataset.trackId
    if (!row || !targetId) return
    const bounds = row.getBoundingClientRect()
    const placement: DropPlacement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
    const nextState = { ...dragStateRef.current, targetId, placement }
    dragStateRef.current = nextState
    setDragState(nextState)
  }

  function finishDragging(event: ReactPointerEvent<HTMLButtonElement>) {
    const completed = dragStateRef.current
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragStateRef.current = undefined
    setDragState(undefined)
    if (completed) moveTrack(completed.draggedId, completed.targetId, completed.placement)
  }

  function moveWithKeyboard(trackId: string, direction: -1 | 1) {
    if (!playlistTracks) return
    const nextOrder = playlistTracks.map((track) => track.id)
    const currentIndex = nextOrder.indexOf(trackId)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= nextOrder.length) return
    ;[nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]]
    commitOrder(nextOrder)
  }

  function sortAlphabetically(direction: 'asc' | 'desc') {
    if (!playlistTracks) return
    const sorted = [...playlistTracks].sort((left, right) => {
      const comparison = `${left.title} ${left.artist}`.localeCompare(
        `${right.title} ${right.artist}`,
        'pt-BR',
        { numeric: true, sensitivity: 'base' },
      )
      return direction === 'asc' ? comparison : -comparison
    })
    commitOrder(sorted.map((track) => track.id))
  }

  if (tracks.length === 0) {
    return <div className="track-list__empty">♪<span>{emptyMessage}</span></div>
  }

  return (
    <div className="track-list">
      {canReorder && (
        <div className="track-list__sorting">
          <span><GripVertical size={14} /> Arraste as músicas para ordenar</span>
          <div role="group" aria-label="Ordenação alfabética da playlist">
            <button type="button" disabled={(playlistTracks?.length ?? 0) < 2} onClick={() => sortAlphabetically('asc')}>
              <ArrowDownAZ size={15} /> Título A–Z
            </button>
            <button type="button" disabled={(playlistTracks?.length ?? 0) < 2} onClick={() => sortAlphabetically('desc')}>
              <ArrowUpAZ size={15} /> Título Z–A
            </button>
          </div>
        </div>
      )}
      <div className="track-list__header" aria-hidden="true">
        <span>Música</span>
        <span>Álbum</span>
        <span>Tempo</span>
        <span />
      </div>
      {tracks.map((track) => {
        const isCurrent = currentTrackId === track.id
        const isDragging = dragState?.draggedId === track.id
        const isDropTarget = dragState?.targetId === track.id && !isDragging
        const rowClassName = [
          'track-row',
          isCurrent ? 'track-row--current' : '',
          isDragging ? 'track-row--dragging' : '',
          isDropTarget ? `track-row--drop-${dragState.placement}` : '',
        ].filter(Boolean).join(' ')
        return (
          <div className={rowClassName} data-track-id={track.id} key={track.id}>
            <div className="track-row__lead">
              {canReorder && (
                <button
                  className="track-row__drag"
                  type="button"
                  aria-label={`Reordenar ${track.title}. Use as setas para mover ou arraste.`}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      moveWithKeyboard(track.id, -1)
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      moveWithKeyboard(track.id, 1)
                    }
                  }}
                  onPointerCancel={finishDragging}
                  onPointerDown={(event) => startDragging(event, track.id)}
                  onPointerMove={updateDragging}
                  onPointerUp={finishDragging}
                >
                  <GripVertical size={16} />
                </button>
              )}
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
            </div>
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
                <button
                  className="track-menu__delete"
                  type="button"
                  onClick={() => {
                    setOpenMenu(undefined)
                    void onDeleteTrack(track.id)
                  }}
                >
                  <Trash2 size={14} /> Excluir do dispositivo
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
