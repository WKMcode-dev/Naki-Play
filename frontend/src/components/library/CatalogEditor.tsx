import { useEffect, useRef, useState } from 'react'
import './CatalogEditor.css'

export type CatalogDraft =
  | { kind: 'create'; name: string }
  | { kind: 'rename'; id: string; name: string }
  | { kind: 'delete'; id: string; name: string }
  | { kind: 'track'; id: string; title: string; artist: string; album: string }

export function CatalogEditor({ initial, error, onSave, onClose }: {
  initial: CatalogDraft
  error?: string
  onSave: (draft: CatalogDraft) => Promise<boolean>
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pending = useRef(false)
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    element?.querySelector('input')?.focus()
    return () => element?.close()
  }, [])

  return (
    <dialog className="catalog-editor" ref={dialog} aria-labelledby="catalog-editor-title"
      onCancel={(event) => { event.preventDefault(); if (!pending.current) onClose() }}>
      <form onSubmit={async (event) => {
        event.preventDefault()
        if (pending.current) return
        pending.current = true
        setSaving(true)
        try {
          if (await onSave(draft)) onClose()
          else setFailed(true)
        } catch { setFailed(true) }
        finally { pending.current = false; setSaving(false) }
      }}>
        <h2 id="catalog-editor-title">{draft.kind === 'create' ? 'Criar playlist' : draft.kind === 'rename' ? 'Renomear playlist' : draft.kind === 'delete' ? 'Excluir playlist' : 'Editar informações'}</h2>
        {draft.kind === 'track' ? <>
          <p>Altera apenas a biblioteca. O arquivo original não será modificado.</p>
          {(['title', 'artist', 'album'] as const).map((field) => (
            <label key={field}>
              <span>{{ title: 'Título', artist: 'Artista', album: 'Álbum' }[field]}</span>
              <input value={draft[field]} maxLength={200} required={field === 'title'} disabled={saving}
                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />
            </label>
          ))}
        </> : draft.kind === 'delete' ? <p>
          Excluir “{draft.name}”? As músicas e vídeos continuarão na biblioteca e nas outras playlists.
          Apenas esta playlist será excluída. Esta ação não pode ser desfeita.
        </p> : <label>
          <span>Nome da playlist</span>
          <input value={draft.name} maxLength={80} required disabled={saving}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>}
        {failed && <p role="alert">{error || 'Não foi possível salvar. Verifique os dados e tente novamente.'}</p>}
        <div className="catalog-actions">
          <button type="button" disabled={saving} onClick={onClose}>Cancelar</button>
          <button type="submit" disabled={saving}>{saving ? 'Aguarde…' : draft.kind === 'delete' ? 'Excluir playlist' : 'Salvar'}</button>
        </div>
      </form>
    </dialog>
  )
}
