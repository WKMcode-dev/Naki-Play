import { Film, Pause, Play, Upload } from 'lucide-react'
import type { MediaTrack } from '../../types/library'
import './VideoLibrary.css'

interface VideoLibraryProps {
  tracks: MediaTrack[]
  currentTrackId?: string
  isPlaying: boolean
  searching: boolean
  onPlay: (id: string) => void
  onImport: () => void
  onDownload: () => void
}

export function VideoLibrary({ tracks, currentTrackId, isPlaying, searching, onPlay, onImport, onDownload }: VideoLibraryProps) {
  return (
    <section className="video-library" aria-label="Vídeos salvos">
      <div className="content-section__heading">
        <div><h2>Seus vídeos</h2><p>{tracks.length} {tracks.length === 1 ? 'vídeo disponível' : 'vídeos disponíveis'} neste dispositivo</p></div>
        <button type="button" onClick={onImport}><Upload size={16} /> Adicionar vídeo</button>
      </div>
      {tracks.length ? <div className="video-library__grid">
        {tracks.map((track) => {
          const playing = currentTrackId === track.id && isPlaying
          return <button className={`video-card${currentTrackId === track.id ? ' video-card--active' : ''}`} key={track.id}
            type="button" aria-label={`${playing ? 'Pausar' : 'Assistir'} ${track.title}`} aria-pressed={currentTrackId === track.id}
            onClick={() => onPlay(track.id)}>
            <span className="video-card__poster" style={{ background: track.cover }}>
              <Film size={46} strokeWidth={1} aria-hidden="true" />
              <span className="video-card__play">{playing ? <Pause size={22} /> : <Play size={22} />}</span>
              <span className="video-card__duration">{track.durationLabel}</span>
            </span>
            <strong>{track.title}</strong><small>{track.artist}</small>
            {currentTrackId === track.id && <span className="video-card__status">{playing ? 'Assistindo agora' : 'Selecionado · pausado'}</span>}
          </button>
        })}
      </div> : <div className="video-library__empty">
        <Film size={32} aria-hidden="true" />
        <h3>{searching ? 'Nenhum vídeo encontrado' : 'Sua sessão de cinema começa aqui'}</h3>
        <p>{searching ? 'Experimente buscar outro título ou autor.' : 'Importe um vídeo ou escolha um formato de vídeo ao baixar um link.'}</p>
        {!searching && <button type="button" onClick={onDownload}>Baixar um vídeo</button>}
      </div>}
    </section>
  )
}
