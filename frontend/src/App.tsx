import { useMemo, useRef, useState } from 'react'
import { WelcomeHero } from './components/home/WelcomeHero/WelcomeHero'
import { ImportDropzone } from './components/library/ImportDropzone/ImportDropzone'
import { MediaDownloadCard } from './components/library/MediaDownloadCard/MediaDownloadCard'
import { TrackList } from './components/library/TrackList/TrackList'
import { Header } from './components/layout/Header/Header'
import { Sidebar } from './components/layout/Sidebar/Sidebar'
import { PlayerBar } from './components/player/PlayerBar/PlayerBar'
import { SettingsPage } from './components/settings/SettingsPage/SettingsPage'
import { useLibrary } from './hooks/useLibrary'
import { mediaEngineAvailable, runningInTauri } from './services/nativeLibrary'
import type { MediaTrack } from './types/library'

const viewContent = {
  library: {
    title: 'Sua biblioteca',
    subtitle: 'Todas as músicas salvas neste dispositivo.',
    empty: 'Adicione uma música para começar sua biblioteca.',
  },
  liked: {
    title: 'Músicas gostadas',
    subtitle: 'Aquelas que ganharam um coraçãozinho.',
    empty: 'Marque uma música como gostada para vê-la aqui.',
  },
  favorites: {
    title: 'Favoritas',
    subtitle: 'As mais especiais entre as especiais.',
    empty: 'Suas faixas favoritas aparecerão aqui.',
  },
  downloads: {
    title: 'Baixar e guardar',
    subtitle: 'Transforme um link autorizado em música ou vídeo para ouvir offline.',
    empty: 'Adicione sua primeira música para começar.',
  },
} as const

function App() {
  const library = useLibrary()
  const [query, setQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isNative = runningInTauri()
  const hasMediaEngine = mediaEngineAvailable()

  const currentPlaylistId = library.activeView.startsWith('playlist:')
    ? library.activeView.slice('playlist:'.length)
    : undefined
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const visibleTracks = useMemo(() => {
    let result: MediaTrack[] = library.tracks

    if (library.activeView === 'liked') {
      result = result.filter((track) => track.isLiked)
    } else if (library.activeView === 'favorites') {
      result = result.filter((track) => track.isFavorite)
    } else if (library.activeView === 'downloads') {
      result = result.filter((track) => track.source === 'local' || track.source === 'direct' || track.source === 'youtube')
    } else if (currentPlaylistId) {
      const playlist = library.playlists.find((item) => item.id === currentPlaylistId)
      result = result.filter((track) => playlist?.trackIds.includes(track.id))
    }

    if (normalizedQuery) {
      result = result.filter((track) =>
        `${track.title} ${track.artist} ${track.album}`
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedQuery),
      )
    }

    return result
  }, [currentPlaylistId, library.activeView, library.playlists, library.tracks, normalizedQuery])

  function requestImport() {
    if (isNative) void library.importFromPicker()
    else fileInputRef.current?.click()
  }

  function createPlaylist() {
    const name = window.prompt('Como vai se chamar a nova playlist?')
    if (name?.trim()) void library.createPlaylist(name)
  }

  function pageDetails() {
    if (currentPlaylistId) {
      const playlist = library.playlists.find((item) => item.id === currentPlaylistId)
      return {
        title: playlist?.name ?? 'Playlist',
        subtitle: 'Uma coleção montada do seu jeitinho.',
        empty: 'Use o menu ⋯ de uma música para adicioná-la aqui.',
      }
    }

    if (
      library.activeView === 'library' ||
      library.activeView === 'liked' ||
      library.activeView === 'favorites' ||
      library.activeView === 'downloads'
    ) {
      return viewContent[library.activeView]
    }
    return null
  }

  const details = pageDetails()

  if (!library.isReady) {
    return <div className="app-loading"><span>♡</span><strong>Preparando sua biblioteca…</strong></div>
  }

  return (
    <div className="app">
      <Sidebar
        activeView={library.activeView}
        appTitle={library.settings.appTitle}
        playlists={library.playlists}
        onCreatePlaylist={createPlaylist}
        onNavigate={library.setActiveView}
      />
      <div className="app__body">
        <Header
          isBusy={library.isBusy}
          query={query}
          userName={library.settings.userName}
          onImport={requestImport}
          onQueryChange={setQuery}
        />
        <input
          ref={fileInputRef}
          className="sr-only"
          multiple
          type="file"
          accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.mp4,.webm,.mov"
          onChange={(event) => event.target.files && library.importBrowserFiles(event.target.files)}
        />

        {(library.error || library.notice) && (
          <div className={library.error ? 'app-notice app-notice--error' : 'app-notice'} role="status">
            {library.error ?? library.notice}
          </div>
        )}

        <main className="app__content">
          {library.activeView === 'settings' ? (
            <SettingsPage
              isBusy={library.isBusy}
              playlistCount={library.playlists.length}
              settings={library.settings}
              trackCount={library.tracks.length}
              onSave={library.saveSettings}
            />
          ) : library.activeView === 'home' ? (
            <>
              <WelcomeHero
                hasTracks={library.tracks.length > 0}
                userName={library.settings.userName}
                onOpenLibrary={() => library.setActiveView('library')}
                onPrimaryAction={() => library.tracks[0]
                  ? library.playTrack(library.tracks[0].id)
                  : requestImport()}
              />
              <section className="content-section">
                <div className="content-section__heading">
                  <div>
                    <h2>{library.tracks.length ? 'Adicionadas recentemente' : 'Sua biblioteca começa aqui'}</h2>
                    <p>{library.tracks.length
                      ? 'Arquivos reais guardados no dispositivo.'
                      : 'Escolha uma música sua para começar.'}</p>
                  </div>
                  {library.tracks.length > 0 && <button type="button" onClick={() => library.setActiveView('library')}>Ver todas</button>}
                </div>
                <TrackList
                  currentTrackId={library.currentTrack?.id}
                  emptyMessage="Adicione uma música usando o botão acima."
                  isPlaying={library.isPlaying}
                  playlists={library.playlists}
                  tracks={visibleTracks.slice(0, 4)}
                  onAddToPlaylist={(playlistId, trackId) => void library.addToPlaylist(playlistId, trackId)}
                  onPlay={library.playTrack}
                  onToggleFavorite={(trackId) => void library.toggleFavorite(trackId)}
                  onToggleLike={(trackId) => void library.toggleLike(trackId)}
                />
              </section>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <h1>{details?.title}</h1>
                  <p>{details?.subtitle}</p>
                </div>
              </div>
              {library.activeView === 'downloads' && (
                <>
                  <MediaDownloadCard
                    analysis={library.mediaAnalysis}
                    isBusy={library.isBusy}
                    isAvailable={hasMediaEngine}
                    status={library.downloadStatus}
                    onAnalyze={library.analyzeMedia}
                    onCancel={library.cancelMediaDownload}
                    onDownload={library.downloadAnalyzedMedia}
                    onReset={library.clearMediaAnalysis}
                  />
                  <ImportDropzone
                    isBusy={library.isBusy}
                    isNative={isNative}
                    onImport={library.importBrowserFiles}
                    onPick={requestImport}
                  />
                </>
              )}
              <TrackList
                currentPlaylistId={currentPlaylistId}
                currentTrackId={library.currentTrack?.id}
                emptyMessage={details?.empty}
                isPlaying={library.isPlaying}
                playlists={library.playlists}
                tracks={visibleTracks}
                onAddToPlaylist={(playlistId, trackId) => void library.addToPlaylist(playlistId, trackId)}
                onPlay={library.playTrack}
                onRemoveFromPlaylist={(playlistId, trackId) => void library.removeFromPlaylist(playlistId, trackId)}
                onToggleFavorite={(trackId) => void library.toggleFavorite(trackId)}
                onToggleLike={(trackId) => void library.toggleLike(trackId)}
              />
              {library.activeView === 'downloads' && (
                <p className="source-note">
                  {hasMediaEngine
                    ? 'Use somente conteúdo próprio, em domínio público, Creative Commons ou que você tenha autorização para salvar. Os arquivos ficam na biblioteca privada do Naki.'
                    : 'A versão do navegador serve para visualizar a interface. A análise, conversão e persistência funcionam no aplicativo instalado para Android ou Windows.'}
                </p>
              )}
            </>
          )}
        </main>

        <PlayerBar
          autoplay={library.settings.autoplay}
          isPlaying={library.isPlaying}
          track={library.currentTrack}
          volume={library.settings.volume}
          onNext={library.playNext}
          onPrevious={library.playPrevious}
          onToggle={() => library.setIsPlaying((playing) => !playing)}
          onToggleLike={(trackId) => void library.toggleLike(trackId)}
          onVolumeChange={library.setVolume}
        />
      </div>
    </div>
  )
}

export default App
