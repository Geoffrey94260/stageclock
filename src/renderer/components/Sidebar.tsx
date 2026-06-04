import { useState } from 'react'
import { useStore, Scene } from '../store/useStore'
import s from './Sidebar.module.css'

export function Sidebar() {
  const { scenes, currentSceneIndex, selectScene, addScene, removeScene } = useStore()
  const [newName, setNewName] = useState('')
  const [newDur, setNewDur] = useState('')

  const parseDuration = (input: string): number => {
<<<<<<< HEAD
    const str = input.trim()
    if (str.includes(':')) {
      const [m, sec] = str.split(':')
      return Math.max(5, parseInt(m || '0') * 60 + parseInt(sec || '0'))
    }
=======
    const str = input.trim().toLowerCase()

    // HH:MM:SS or MM:SS
    if (str.includes(':')) {
      const parts = str.split(':').map(p => parseInt(p) || 0)
      if (parts.length === 3) return Math.max(5, parts[0] * 3600 + parts[1] * 60 + parts[2])
      return Math.max(5, parts[0] * 60 + (parts[1] || 0))
    }

    // 1h30m / 1h30 / 1h / 90m / 30s
    const hMatch = str.match(/^(\d+)h(\d+)?m?$/)
    if (hMatch) return Math.max(5, parseInt(hMatch[1]) * 3600 + (parseInt(hMatch[2] || '0') || 0) * 60)
    const mMatch = str.match(/^(\d+)min?$/)
    if (mMatch) return Math.max(5, parseInt(mMatch[1]) * 60)
    const sMatch = str.match(/^(\d+)s$/)
    if (sMatch) return Math.max(5, parseInt(sMatch[1]))

    // Plain number: < 20 = minutes, otherwise seconds
>>>>>>> 32413bf (V2.0.0 - bouton precedente, formats duree, date/heure output, fix OSC/WS, icone)
    const n = parseInt(str)
    if (isNaN(n) || n <= 0) return 300
    return n < 20 ? n * 60 : n
  }

  const fmt = (secs: number) => {
<<<<<<< HEAD
    const m = Math.floor(secs / 60)
    const ss = secs % 60
=======
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const ss = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
>>>>>>> 32413bf (V2.0.0 - bouton precedente, formats duree, date/heure output, fix OSC/WS, icone)
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    const duration = parseDuration(newDur || '5:00')
    addScene(name, name, duration)
    setNewName('')
    setNewDur('')
  }

  return (
    <aside className={s.sidebar}>
      <div className={s.label}>Rundown</div>

      <div className={s.list}>
        {scenes.map((scene: Scene, i: number) => (
          <div
            key={scene.id}
            className={`${s.item} ${i === currentSceneIndex ? s.active : ''}`}
            onClick={() => selectScene(i)}
          >
            <div className={s.dot} />
            <div className={s.info}>
              <div className={s.name}>{scene.name}</div>
              <div className={s.dur}>{fmt(scene.duration)}</div>
            </div>
            <button
              className={s.del}
              onClick={e => { e.stopPropagation(); removeScene(scene.id) }}
              aria-label="Supprimer la scène"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className={s.addArea}>
        <input
          className={s.input}
          placeholder="Nom de la scène"
          maxLength={28}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <input
          className={s.input}
<<<<<<< HEAD
          placeholder="Durée (ex : 5:00)"
          maxLength={8}
=======
          placeholder="Durée (5:00, 1h30, 90m…)"
          maxLength={10}
>>>>>>> 32413bf (V2.0.0 - bouton precedente, formats duree, date/heure output, fix OSC/WS, icone)
          value={newDur}
          onChange={e => setNewDur(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className={s.addBtn} onClick={handleAdd}>
          + Ajouter la scène
        </button>
      </div>
    </aside>
  )
}
