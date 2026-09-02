import { useState } from 'react'
import {
  Check,
  Database,
  Moon,
  Palette,
  Save,
  SlidersHorizontal,
  Sun,
  UserRound,
} from 'lucide-react'
import type { AppSettings, ThemeMode } from '../../../types/library'
import './SettingsPage.css'

interface SettingsPageProps {
  isBusy: boolean
  playlistCount: number
  settings: AppSettings
  trackCount: number
  onSave: (settings: AppSettings) => Promise<boolean>
}

const presets = [
  {
    name: 'Notion',
    primaryColor: '#37352f',
    accentColor: '#2383e2',
    lightBackground: '#ffffff',
    darkBackground: '#191919',
  },
  {
    name: 'Oceano',
    primaryColor: '#164e63',
    accentColor: '#0891b2',
    lightBackground: '#f8fafc',
    darkBackground: '#111827',
  },
  {
    name: 'Floresta',
    primaryColor: '#365314',
    accentColor: '#65a30d',
    lightBackground: '#fafdf7',
    darkBackground: '#172012',
  },
  {
    name: 'Âmbar',
    primaryColor: '#78350f',
    accentColor: '#d97706',
    lightBackground: '#fffbeb',
    darkBackground: '#1c1917',
  },
]

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <span className="color-field__control">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <code>{value.toUpperCase()}</code>
      </span>
    </label>
  )
}

function Toggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean
  description: string
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="settings-toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  )
}

export function SettingsPage({
  isBusy,
  playlistCount,
  settings,
  trackCount,
  onSave,
}: SettingsPageProps) {
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(false)

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaved(false)
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    setSaved(await onSave(draft))
  }

  return (
    <div className="settings-page">
      <div className="page-heading settings-page__heading">
        <div>
          <h1>Configurações</h1>
          <p>Personalize a aparência e o comportamento do aplicativo.</p>
        </div>
        <button className="settings-save" type="button" disabled={isBusy} onClick={() => void save()}>
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? 'Salvo' : isBusy ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>

      <section className="settings-card">
        <div className="settings-card__title">
          <span><UserRound size={18} /></span>
          <div><h2>Perfil e identidade</h2><p>Informações guardadas somente neste dispositivo.</p></div>
        </div>
        <div className="settings-grid settings-grid--two">
          <label className="text-field">
            <span>Nome de usuário</span>
            <input
              maxLength={60}
              value={draft.userName}
              placeholder="Como ela quer ser chamada?"
              onChange={(event) => update('userName', event.target.value)}
            />
          </label>
          <label className="text-field">
            <span>Nome da aplicação</span>
            <input
              maxLength={40}
              value={draft.appTitle}
              placeholder="Naki"
              onChange={(event) => update('appTitle', event.target.value)}
            />
            <small>A marca e o título da janela passarão a usar esse nome.</small>
          </label>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__title">
          <span><Palette size={18} /></span>
          <div><h2>Aparência</h2><p>Modo claro, escuro e uma paleta totalmente personalizada.</p></div>
        </div>

        <div className="theme-modes" role="group" aria-label="Modo do tema">
          {([
            ['light', Sun, 'Claro'],
            ['dark', Moon, 'Escuro'],
            ['system', SlidersHorizontal, 'Do sistema'],
          ] as const).map(([mode, Icon, label]) => (
            <button
              className={draft.themeMode === mode ? 'theme-mode theme-mode--active' : 'theme-mode'}
              key={mode}
              type="button"
              onClick={() => update('themeMode', mode as ThemeMode)}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="palette-presets">
          {presets.map((preset) => {
            const active = draft.primaryColor === preset.primaryColor && draft.accentColor === preset.accentColor
            return (
              <button
                className={active ? 'palette-preset palette-preset--active' : 'palette-preset'}
                key={preset.name}
                type="button"
                onClick={() => {
                  setDraft((current) => ({ ...current, ...preset }))
                  setSaved(false)
                }}
              >
                <span className="palette-preset__colors">
                  <i style={{ background: preset.primaryColor }} />
                  <i style={{ background: preset.accentColor }} />
                  <i style={{ background: preset.lightBackground }} />
                </span>
                <span>{preset.name}</span>
                {active && <Check size={13} />}
              </button>
            )
          })}
        </div>

        <div className="settings-grid settings-grid--colors">
          <ColorField label="Cor principal" value={draft.primaryColor} onChange={(value) => update('primaryColor', value)} />
          <ColorField label="Cor de destaque" value={draft.accentColor} onChange={(value) => update('accentColor', value)} />
          <ColorField label="Fundo claro" value={draft.lightBackground} onChange={(value) => update('lightBackground', value)} />
          <ColorField label="Fundo escuro" value={draft.darkBackground} onChange={(value) => update('darkBackground', value)} />
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__title">
          <span><SlidersHorizontal size={18} /></span>
          <div><h2>Experiência</h2><p>Ajustes de reprodução e conforto visual.</p></div>
        </div>
        <div className="settings-toggles">
          <Toggle
            checked={draft.autoplay}
            label="Continuar tocando"
            description="Tocar automaticamente a próxima música da fila atual."
            onChange={(value) => update('autoplay', value)}
          />
          <Toggle
            checked={draft.compactMode}
            label="Biblioteca compacta"
            description="Exibir mais músicas ao mesmo tempo nas listas."
            onChange={(value) => update('compactMode', value)}
          />
          <Toggle
            checked={draft.reduceMotion}
            label="Reduzir animações"
            description="Diminuir movimentos e transições da interface."
            onChange={(value) => update('reduceMotion', value)}
          />
        </div>
        <label className="volume-setting">
          <span><strong>Volume inicial</strong><small>{Math.round(draft.volume * 100)}%</small></span>
          <input type="range" min="0" max="1" step="0.01" value={draft.volume} onChange={(event) => update('volume', Number(event.target.value))} />
        </label>
      </section>

      <section className="settings-card settings-storage">
        <div className="settings-card__title">
          <span><Database size={18} /></span>
          <div><h2>Dados locais</h2><p>Sem conta obrigatória, rastreamento ou anúncios.</p></div>
        </div>
        <div className="storage-stats">
          <span><strong>{trackCount}</strong><small>músicas neste dispositivo</small></span>
          <span><strong>{playlistCount}</strong><small>playlists criadas</small></span>
          <span><strong>SQLite</strong><small>banco privado local</small></span>
        </div>
        <p className="storage-note">As configurações, playlists e referências dos arquivos permanecem no dispositivo. As músicas importadas são copiadas para a pasta privada do aplicativo.</p>
      </section>
    </div>
  )
}
