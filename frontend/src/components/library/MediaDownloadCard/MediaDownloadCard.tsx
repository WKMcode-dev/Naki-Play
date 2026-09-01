import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Download, Heart, Link2, LoaderCircle, RotateCcw, X } from 'lucide-react'
import type { ExternalMediaAnalysis, MediaDownloadStatus } from '../../../types/library'
import './MediaDownloadCard.css'

interface MediaDownloadCardProps {
  analysis?: ExternalMediaAnalysis
  isBusy: boolean
  isAvailable: boolean
  status: MediaDownloadStatus
  onAnalyze: (url: string) => Promise<boolean>
  onCancel: () => Promise<void>
  onDownload: (optionId: string, confirmedAuthorized: boolean) => Promise<boolean>
  onReset: () => void
}

function durationLabel(seconds: number) {
  if (!seconds) return 'Duração não informada'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0')
  return hours ? `${hours}:${minutes.toString().padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

function etaLabel(seconds?: number) {
  if (!seconds) return ''
  if (seconds < 60) return `aprox. ${seconds}s restantes`
  return `aprox. ${Math.ceil(seconds / 60)} min restantes`
}

export function MediaDownloadCard({
  analysis,
  isBusy,
  isAvailable,
  status,
  onAnalyze,
  onCancel,
  onDownload,
  onReset,
}: MediaDownloadCardProps) {
  const [url, setUrl] = useState('')
  const [optionId, setOptionId] = useState('')
  const [confirmedAuthorized, setConfirmedAuthorized] = useState(false)

  const defaultOption = useMemo(
    () => analysis?.formats.find((option) => option.id === 'audio-192') ?? analysis?.formats[0],
    [analysis],
  )

  const selectedOptionId = optionId || defaultOption?.id || ''

  async function analyze(event: FormEvent) {
    event.preventDefault()
    if (!url.trim()) return
    setOptionId('')
    setConfirmedAuthorized(false)
    await onAnalyze(url.trim())
  }

  const active = status.stage !== 'idle' && status.stage !== 'finished'

  return (
    <section className="media-download">
      <div className="media-download__heading">
        <span className="media-download__icon"><Heart size={20} fill="currentColor" /></span>
        <div>
          <h2>Guardar uma música para você</h2>
          <p>Cole o link, escolha MP3 ou MP4 e o Naki cuida do restante.</p>
        </div>
      </div>

      {!analysis ? (
        <form className="media-download__form" onSubmit={analyze}>
          <label>
            <Link2 size={16} />
            <input
              type="url"
              value={url}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-label="Link da música ou vídeo"
              disabled={isBusy || !isAvailable}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <button type="submit" disabled={isBusy || !isAvailable || !url.trim()}>
            {isBusy ? <LoaderCircle className="media-download__spinner" size={16} /> : <Link2 size={16} />}
            {isBusy ? 'Analisando…' : 'Analisar link'}
          </button>
        </form>
      ) : (
        <div className="media-download__result">
          <div className="media-download__media">
            {analysis.thumbnailUrl ? (
              <img src={analysis.thumbnailUrl} alt="" />
            ) : (
              <span><Heart size={26} /></span>
            )}
            <div>
              <strong>{analysis.title}</strong>
              <small>{analysis.author} · {durationLabel(analysis.durationSeconds)}</small>
            </div>
            {!active && (
              <button type="button" className="media-download__reset" aria-label="Analisar outro link" onClick={onReset}>
                <RotateCcw size={15} />
              </button>
            )}
          </div>

          {status.stage === 'finished' ? (
            <div className="media-download__complete">
              <CheckCircle2 size={20} />
              <div><strong>Prontinho!</strong><span>{status.message}</span></div>
            </div>
          ) : active ? (
            <div className="media-download__progress">
              <div>
                <span>{status.message ?? 'Baixando…'}</span>
                <strong>{Math.round(status.progress)}%</strong>
              </div>
              <progress max="100" value={status.progress} />
              <div>
                <small>{etaLabel(status.etaSeconds)}</small>
                <button
                  type="button"
                  disabled={status.stage === 'preparing' || status.stage === 'cancelling'}
                  onClick={() => void onCancel()}
                >
                  <X size={13} /> {status.stage === 'cancelling' ? 'Cancelando…' : 'Cancelar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="media-download__options">
              <label>
                <span>Formato e qualidade</span>
                <select value={selectedOptionId} onChange={(event) => setOptionId(event.target.value)}>
                  <optgroup label="Somente áudio">
                    {analysis.formats.filter((option) => option.kind === 'audio').map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Vídeo com áudio">
                    {analysis.formats.filter((option) => option.kind === 'video').map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <label className="media-download__authorization">
                <input
                  type="checkbox"
                  checked={confirmedAuthorized}
                  onChange={(event) => setConfirmedAuthorized(event.target.checked)}
                />
                <span>Confirmo que este conteúdo é meu, livre ou tenho autorização para salvá-lo.</span>
              </label>
              <button
                type="button"
                className="media-download__start"
                disabled={!selectedOptionId || !confirmedAuthorized || isBusy}
                onClick={() => void onDownload(selectedOptionId, confirmedAuthorized)}
              >
                <Download size={17} /> Baixar e adicionar à biblioteca
              </button>
            </div>
          )}
        </div>
      )}

      <p className="media-download__note">
        {isAvailable
          ? 'O processamento acontece neste dispositivo e pode levar alguns minutos em vídeos longos.'
          : 'Instale e abra a versão Android ou Windows para analisar e baixar links.'}
      </p>
    </section>
  )
}
