import { ArrowRight, Heart, Play, Sparkles } from 'lucide-react'
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
        <span className="eyebrow"><Sparkles size={13} /> Feito especialmente para {userName}</span>
        <h1>Suas músicas,<br /><em>do seu jeitinho.</em></h1>
        <p>Um cantinho para guardar as canções, memórias e coisinhas que fazem o coração ficar quentinho.</p>
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
        <span className="hero-art__heart hero-art__heart--one"><Heart fill="currentColor" /></span>
        <span className="hero-art__heart hero-art__heart--two"><Heart fill="currentColor" /></span>
        <div className="record-sleeve">
          <span className="record-sleeve__shine" />
          <div className="record-sleeve__label">
            <span>para</span>
            <strong>você</strong>
            <small>com amor ♡</small>
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
