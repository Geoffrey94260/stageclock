import { useState } from 'react'
import { useStore, Scene } from '../store/useStore'
import s from './Sidebar.module.css'

export function Sidebar() {
  const { scenes, currentSceneIndex, selectScene, addScene, removeScene } = useStore()
  const [newName, setNewName] = useState('')
  const [newDur, setNewDur] = useState('')

  const parseDuration = (input: string): number => {
    const str = input.trim()
    if (str.includes(':')) {
      const [m, sec] = str.split(':')
      return Math.max(5, parseInt(m || '0') * 60 + parseInt(sec || '0'))
    }
    const n = parseInt(str)
    if (isNaN(n) || n <= 0) return 300
    return n < 20 ? n * 60 : n
  }

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60)
    const ss = secs % 60
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
            {scenes.length > 1 && (
              <button
                className={s.del}
                onClick={e => { e.stopPropagation(); removeScene(scene.id) }}
                aria-label="Supprimer la scène"
              >
                ×
              </button>
            )}
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
          placeholder="Durée (ex : 5:00)"
          maxLength={8}
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
