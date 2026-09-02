import { ArrowRight, Headphones, ListMusic, Play } from 'lucide-react'
import './WelcomeHero.css'

interface WelcomeHeroProps {
  hasTracks: boolean
  onOpenLibrary: () => void
  onPrimaryAction: () => void
  userName: string
}

export function WelcomeHero({ hasTracks, onOpenLibrary, onPrimaryAction, userName }: WelcomeHeroProps) {
  return (
    <section className="welcome-hero">
      <div className="welcome-hero__copy">
        <span className="eyebrow"><Headphones size={13} /> Biblioteca de {userName}</span>
        <h1>Suas músicas,<br /><em>em um só lugar.</em></h1>
        <p>Organize sua biblioteca, crie playlists e ouça seus arquivos offline com uma experiência simples e pessoal.</p>
        <div className="welcome-hero__actions">
          <button className="hero-play" type="button" onClick={onPrimaryAction}>
            <Play size={15} fill="currentColor" />
            {hasTracks ? 'Tocar sua biblioteca' : 'Adicionar primeira música'}
          </button>
          <button className="hero-link" type="button" onClick={onOpenLibrary}>
            Ver biblioteca <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className="hero-art" aria-hidden="true">
        <span className="hero-art__halo" />
        <span className="hero-art__heart hero-art__heart--one"><Headphones /></span>
        <span className="hero-art__heart hero-art__heart--two"><ListMusic /></span>
        <div className="record-sleeve">
          <span className="record-sleeve__shine" />
          <div className="record-sleeve__label">
            <span>Naki</span>
            <strong>Play</strong>
            <small>sua música, seu espaço</small>
          </div>
        </div>
        <div className="vinyl">
          <span className="vinyl__ring" />
          <span className="vinyl__label">N</span>
        </div>
      </div>
    </section>
  )
}
