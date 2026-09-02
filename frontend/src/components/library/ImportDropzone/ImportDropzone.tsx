import { useRef, useState, type DragEvent } from 'react'
import { FileAudio, FolderOpen, UploadCloud } from 'lucide-react'
import './ImportDropzone.css'

interface ImportDropzoneProps {
  isBusy: boolean
  isNative: boolean
  onImport: (files: FileList | File[]) => number
  onPick: () => void
}

export function ImportDropzone({ isBusy, isNative, onImport, onPick }: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [message, setMessage] = useState('MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, MP4 e WEBM')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | File[]) {
    const count = onImport(files)
    setMessage(
      count > 0
        ? `${count} ${count === 1 ? 'arquivo adicionado' : 'arquivos adicionados'} nesta sessão`
        : 'Não encontrei um arquivo de áudio ou vídeo compatível.',
    )
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  function pickFiles() {
    if (isNative) onPick()
    else inputRef.current?.click()
  }

  return (
    <div
      className={`import-dropzone ${isDragging ? 'import-dropzone--active' : ''}`}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        multiple
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.mp4,.webm,.mov"
        onChange={(event) => event.target.files && handleFiles(event.target.files)}
      />
      <span className="import-dropzone__icon"><UploadCloud size={25} /></span>
      <span className="import-dropzone__copy">
        <strong>Solte suas músicas aqui</strong>
        <small>{message}</small>
      </span>
      <button className="import-dropzone__button" type="button" disabled={isBusy} onClick={pickFiles}>
        <FolderOpen size={15} /> {isBusy ? 'Importando…' : 'Escolher arquivos'}
      </button>
      <FileAudio className="import-dropzone__decoration" size={48} aria-hidden="true" />
    </div>
  )
}
