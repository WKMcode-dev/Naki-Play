import {
  Download,
  Heart,
  Home,
  LibraryBig,
  ListMusic,
  Music2,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react'
import type { LibraryView, Playlist } from '../../../types/library'
import './Sidebar.css'

interface SidebarProps {
  activeView: LibraryView
  appTitle: string
  playlists: Playlist[]
  onCreatePlaylist: () => void
  onNavigate: (view: LibraryView) => void
}

const primaryItems = [
  { id: 'home' as const, label: 'Início', mobileLabel: 'Início', icon: Home },
  { id: 'library' as const, label: 'Biblioteca', mobileLabel: 'Músicas', icon: LibraryBig },
  { id: 'liked' as const, label: 'Gostadas', mobileLabel: 'Gostadas', icon: Heart },
  { id: 'favorites' as const, label: 'Favoritas', mobileLabel: 'Favoritas', icon: Sparkles },
  { id: 'downloads' as const, label: 'Arquivos locais', mobileLabel: 'Arquivos', icon: Download },
  { id: 'settings' as const, label: 'Configurações', mobileLabel: 'Ajustes', icon: Settings },
]

export function Sidebar({
  activeView,
  appTitle,
  playlists,
  onCreatePlaylist,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => onNavigate('home')}>
        <span className="brand__mark" aria-hidden="true"><Music2 size={20} /></span>
        <span>
          <strong>{appTitle}</strong>
          <small>play</small>
        </span>
      </button>

      <nav className="sidebar__nav" aria-label="Biblioteca principal">
        {primaryItems.map(({ id, label, mobileLabel, icon: Icon }) => (
          <button
            className={`sidebar__item ${activeView === id ? 'sidebar__item--active' : ''}`}
            data-mobile-label={mobileLabel}
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar__section">
        <div className="sidebar__section-title">
          <span>Suas playlists</span>
          <button type="button" aria-label="Criar playlist" onClick={onCreatePlaylist}>
            <Plus size={17} />
          </button>
        </div>
        <div className="sidebar__playlists">
          {playlists.map((playlist) => {
            const view = `playlist:${playlist.id}` as const
            return (
              <button
                className={`sidebar__item sidebar__item--playlist ${activeView === view ? 'sidebar__item--active' : ''}`}
                key={playlist.id}
                type="button"
                onClick={() => onNavigate(view)}
              >
                <ListMusic size={16} strokeWidth={1.8} />
                <span>{playlist.name}</span>
              </button>
            )
          })}
        </div>
      </div>

    </aside>
  )
}
