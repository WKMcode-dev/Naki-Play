import { useState, type FormEvent } from 'react'
import { Download, Link2, ShieldCheck } from 'lucide-react'
import './DirectDownloadCard.css'

interface DirectDownloadCardProps {
  isBusy: boolean
  onDownload: (url: string) => Promise<boolean>
}

export function DirectDownloadCard({ isBusy, onDownload }: DirectDownloadCardProps) {
  const [url, setUrl] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!url.trim()) return
    if (await onDownload(url)) setUrl('')
  }

  return (
    <section className="direct-download">
      <div className="direct-download__heading">
        <span className="direct-download__icon"><Link2 size={19} /></span>
        <div>
          <h2>Baixar por link direto</h2>
          <p>Para arquivos próprios, domínio público ou conteúdo com download autorizado.</p>
        </div>
      </div>
      <form className="direct-download__form" onSubmit={submit}>
        <input
          type="url"
          value={url}
          placeholder="https://exemplo.com/minha-musica.mp3"
          aria-label="URL direta do arquivo"
          onChange={(event) => setUrl(event.target.value)}
        />
        <button type="submit" disabled={isBusy || !url.trim()}>
          <Download size={16} />
          {isBusy ? 'Baixando…' : 'Baixar arquivo'}
        </button>
      </form>
      <p className="direct-download__notice">
        <ShieldCheck size={14} />
        Links de páginas do YouTube e Spotify não são arquivos diretos e não são aceitos.
      </p>
    </section>
  )
}
