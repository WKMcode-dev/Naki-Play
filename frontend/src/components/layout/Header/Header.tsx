import { FolderPlus, Search } from 'lucide-react'
import './Header.css'

interface HeaderProps {
  isBusy: boolean
  query: string
  userName: string
  onImport: () => void
  onQueryChange: (query: string) => void
}

export function Header({ isBusy, query, userName, onImport, onQueryChange }: HeaderProps) {
  return (
    <header className="app-header">
      <label className="search-box">
        <Search size={17} aria-hidden="true" />
        <input
          aria-label="Buscar na biblioteca"
          type="search"
          value={query}
          placeholder="Buscar uma música, artista ou playlist..."
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <button className="import-button" type="button" disabled={isBusy} onClick={onImport}>
        <FolderPlus size={17} />
        <span>{isBusy ? 'Aguarde…' : 'Adicionar música'}</span>
      </button>
      <div className="profile-dot" aria-label={`Perfil local de ${userName}`} title={userName}>
        {userName.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'N'}
      </div>
    </header>
  )
}
