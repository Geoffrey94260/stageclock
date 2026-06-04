import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import s from './MenuBar.module.css'

type MenuKey = 'fichier' | 'output' | 'params' | null

interface Props {
  onToast: (msg: string) => void
}

export function MenuBar({ onToast }: Props) {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)
  const [displays, setDisplays] = useState<{ index: number; label: string }[]>([])
  const [outputOpen, setOutputOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  const {
    settings, updateSettings,
    outputSettings, updateOutputSettings,
    getSessionData, loadSessionData, setFilePath, currentFilePath,
  } = useStore()

  useEffect(() => {
    window.electronAPI?.getDisplays().then(setDisplays).catch(() => {
      setDisplays([
        { index: 0, label: 'Écran principal (Display 1)' },
        { index: 1, label: 'Écran externe (Display 2)' },
      ])
    })
    window.electronAPI?.onMaximized?.((v) => setIsMaximized(v))
    const unsub = window.electronAPI?.onOutputClosed?.(() => {
      setOutputOpen(false)
      onToast('Output fermé (Échap)')
    })
    return () => { unsub?.() }
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (key: MenuKey) => setOpenMenu(prev => prev === key ? null : key)
  const close = () => setOpenMenu(null)

  const handleSave = async (saveAs = false) => {
    close()
    const data = getSessionData()
    const result = await window.electronAPI?.saveSession(data, saveAs ? undefined : currentFilePath ?? undefined)
    if (result?.success) {
      setFilePath(result.filePath ?? null)
      onToast('Session sauvegardée ✓')
    }
  }

  const handleOpen = async () => {
    close()
    const result = await window.electronAPI?.openSession()
    if (result?.success && result.data) {
      loadSessionData(result.data, result.filePath ?? '')
      onToast('Session chargée ✓')
    }
  }

  const handleOpenOutput = async () => {
    close()
    await window.electronAPI?.openOutput(outputSettings.displayIndex)
    setOutputOpen(true)
    onToast('Fenêtre output ouverte — appuie sur Échap pour fermer')
  }

  const handleCloseOutput = async () => {
    close()
    await window.electronAPI?.closeOutput()
    setOutputOpen(false)
    onToast('Output fermé')
  }

  const toggleNDI = async () => {
    const next = !outputSettings.ndiEnabled
    updateOutputSettings({ ndiEnabled: next })
    if (next) {
      const result = await window.electronAPI?.startNDI(
        outputSettings.ndiName,
        outputSettings.ndiResolution
      )
      if (result?.success) {
        onToast(`NDI activé — ${result.width}x${result.height}@${result.fps}fps`)
      } else {
        updateOutputSettings({ ndiEnabled: false })
        onToast(result?.error ?? 'NDI non disponible')
      }
    } else {
      await window.electronAPI?.stopNDI()
      onToast('NDI désactivé')
    }
  }

  return (
    <div className={`${s.bar} drag-region`} ref={barRef}>
      <div className={s.logo}>
        <div className={s.logoDot} />
        <span className={s.logoName}>Stageclock</span>
      </div>

      {/* ── FICHIER ── */}
      <div className={`${s.menuItem} no-drag`}>
        <button className={`${s.trigger} ${openMenu === 'fichier' ? s.open : ''}`} onClick={() => toggle('fichier')}>
          Fichier <Chevron />
        </button>
        {openMenu === 'fichier' && (
          <div className={s.dropdown}>
            <div className={s.section}>Session</div>
            <DDItem icon="✦" label="Nouvelle session" shortcut="⌘N" onClick={() => { close(); loadSessionData('{}', ''); onToast('Nouvelle session créée') }} />
            <DDItem icon="📂" label="Ouvrir une session…" shortcut="⌘O" onClick={handleOpen} />
            <div className={s.sep} />
            <DDItem icon="💾" label="Enregistrer" shortcut="⌘S" onClick={() => handleSave(false)} />
            <DDItem icon="📄" label="Enregistrer sous…" shortcut="⇧⌘S" onClick={() => handleSave(true)} />
            <div className={s.sep} />
            <DDItem icon="✕" label="Quitter" danger onClick={() => { close(); window.close() }} />
          </div>
        )}
      </div>

      {/* ── OUTPUT ── */}
      <div className={`${s.menuItem} no-drag`}>
        <button className={`${s.trigger} ${openMenu === 'output' ? s.open : ''}`} onClick={() => toggle('output')}>
          Output <Chevron />
        </button>
        {openMenu === 'output' && (
          <div className={s.dropdown} style={{ minWidth: 280 }}>
            <div className={s.section}>Écran</div>
            <div className={s.selectRow}>
              <div className={s.selectLabel}>Écran de sortie</div>
              <select
                className={s.select}
                value={outputSettings.displayIndex}
                onChange={e => updateOutputSettings({ displayIndex: Number(e.target.value) })}
              >
                {displays.map(d => <option key={d.index} value={d.index}>{d.label}</option>)}
              </select>
            </div>
            <ToggleRow icon="⛶" label="Plein écran" value={outputSettings.fullscreen}
              onChange={v => { updateOutputSettings({ fullscreen: v }); onToast(`Plein écran ${v ? 'activé' : 'désactivé'}`) }} />
            <div className={s.sep} />
            <div className={s.section}>NDI</div>
            <ToggleRow icon="📡" label="Activer la sortie NDI" value={outputSettings.ndiEnabled}
              onChange={() => toggleNDI()} />
            <div className={s.selectRow}>
              <div className={s.selectLabel}>Nom du flux NDI</div>
              <input
                className={s.input}
                value={outputSettings.ndiName}
                onChange={e => updateOutputSettings({ ndiName: e.target.value })}
              />
            </div>
            <div className={s.selectRow}>
              <div className={s.selectLabel}>Résolution</div>
              <select className={s.select} value={outputSettings.ndiResolution}
                onChange={e => updateOutputSettings({ ndiResolution: e.target.value as any })}>
                <option value="1080p30">1920 × 1080 — 30fps</option>
                <option value="1080p60">1920 × 1080 — 60fps</option>
                <option value="4k30">3840 × 2160 — 30fps</option>
              </select>
            </div>
            <div className={s.sep} />
            <DDItem icon="▶" label="Ouvrir la fenêtre output" onClick={handleOpenOutput} />
            <DDItem icon="⛶" label="Basculer plein écran output" onClick={() => { close(); window.electronAPI?.toggleOutputFullscreen?.() }} />
            <DDItem icon="✕" label="Fermer la fenêtre output" onClick={handleCloseOutput} />
          </div>
        )}
      </div>

      {/* ── PARAMÈTRES ── */}
      <div className={`${s.menuItem} no-drag`}>
        <button className={`${s.trigger} ${openMenu === 'params' ? s.open : ''}`} onClick={() => toggle('params')}>
          Paramètres <Chevron />
        </button>
        {openMenu === 'params' && (
          <div className={s.dropdown} style={{ minWidth: 290 }}>
            <div className={s.section}>Apparence</div>
            <div className={s.colorRow}>
              <span className={s.colorLabel}>Couleur du timer</span>
              <div className={s.swatches}>
                {['#ffffff', '#5DCAA5', '#EF9F27', '#85B7EB', '#ED93B1'].map(c => (
                  <div
                    key={c}
                    className={`${s.swatch} ${settings.timerColor === c ? s.activeSwatch : ''}`}
                    style={{ background: c }}
                    onClick={() => updateSettings({ timerColor: c })}
                  />
                ))}
              </div>
            </div>
            <div className={s.selectRow}>
              <div className={s.selectLabel}>Taille du texte (output)</div>
              <select className={s.select} value={settings.fontSize}
                onChange={e => updateSettings({ fontSize: e.target.value as any })}>
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="large">Large</option>
                <option value="xlarge">Très large</option>
              </select>
            </div>
<<<<<<< HEAD
            <ToggleRow icon="🔢" label="Afficher les dixièmes en fin" value={settings.showTenths}
              onChange={v => updateSettings({ showTenths: v })} />
            <ToggleRow icon="💬" label="Afficher le titre de scène" value={settings.showTitle}
              onChange={v => updateSettings({ showTitle: v })} />
            <div className={s.sep} />
            <div className={s.section}>Comportement</div>
            <ToggleRow icon="⏭" label="Auto-avance à 0" value={settings.autoAdvance}
              onChange={v => updateSettings({ autoAdvance: v })} />
            <ToggleRow icon="🔔" label="Son d'alerte à 0" value={settings.soundAlert}
              onChange={v => updateSettings({ soundAlert: v })} />
=======
            <ToggleRow icon="💬" label="Afficher le titre de scène" value={settings.showTitle}
              onChange={v => updateSettings({ showTitle: v })} />
            <div className={s.sep} />
>>>>>>> 32413bf (V2.0.0 - bouton precedente, formats duree, date/heure output, fix OSC/WS, icone)
            <div className={s.selectRow}>
              <div className={s.selectLabel}>Protocole Companion</div>
              <select className={s.select} value={settings.companionProtocol}
                onChange={e => updateSettings({ companionProtocol: e.target.value as any })}>
                <option value="osc">OSC — port {settings.oscPort}</option>
                <option value="ws">WebSocket — port {settings.wsPort}</option>
                <option value="both">OSC + WebSocket</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Status right side */}
      <div className={`${s.rightArea} no-drag`}>
        <StatusDot status={useStore(s => s.timerStatus)} />
        {outputSettings.ndiEnabled && <span className={s.ndiBadge}>NDI</span>}
      </div>

      {/* Window controls */}
      <div className={`${s.winControls} no-drag`}>
        <button className={s.winBtn} onClick={() => window.electronAPI?.minimize()} title="Réduire">
          <svg width="11" height="2" viewBox="0 0 11 2"><rect width="11" height="1.5" rx="0.75" fill="currentColor"/></svg>
        </button>
        <button className={s.winBtn} onClick={() => window.electronAPI?.maximize()} title={isMaximized ? 'Restaurer' : 'Agrandir'}>
          {isMaximized
            ? <svg width="11" height="11" viewBox="0 0 11 11"><path d="M3 1h7v7M1 3h7v7" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
            : <svg width="11" height="11" viewBox="0 0 11 11"><rect x="0.75" y="0.75" width="9.5" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
          }
        </button>
        <button className={`${s.winBtn} ${s.closeBtn}`} onClick={() => window.electronAPI?.close()} title="Fermer">
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Chevron() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function DDItem({ icon, label, shortcut, danger, onClick }: {
  icon: string; label: string; shortcut?: string; danger?: boolean; onClick?: () => void
}) {
  return (
    <div className={`${s.ddItem} ${danger ? s.danger : ''}`} onClick={onClick}>
      <span className={s.ddIcon}>{icon}</span>
      <span className={s.ddLabel}>{label}</span>
      {shortcut && <span className={s.shortcut}>{shortcut}</span>}
    </div>
  )
}

function ToggleRow({ icon, label, value, onChange }: {
  icon: string; label: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className={s.toggleRow}>
      <span className={s.ddIcon}>{icon}</span>
      <span className={s.ddLabel}>{label}</span>
      <div className={`${s.toggle} ${value ? s.toggleOn : ''}`} onClick={() => onChange(!value)} />
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'running' ? '#1D9E75' : status === 'overtime' ? '#E24B4A' : '#EF9F27'
  const label = status === 'running' ? 'running' : status === 'overtime' ? 'overtime' : 'pause'
  return (
    <>
      <div className={s.statusDot} style={{ background: color }} />
      <span className={s.statusLabel}>{label}</span>
    </>
  )
}
