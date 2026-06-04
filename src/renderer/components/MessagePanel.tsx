import { useState } from 'react'
import { useStore } from '../store/useStore'
import s from './MessagePanel.module.css'

export function MessagePanel() {
  const { messages, sendMessage, toggleMessage, hideAllMessages, clearMessages } = useStore()
  const [text, setText] = useState('')

  const activeMsg = messages.find(m => m.active)

  const handleSend = () => {
    const t = text.trim()
    if (!t) return
    sendMessage(t)
    setText('')
    window.electronAPI?.sendMessage({ text: t })
  }

  const handleToggle = (id: string) => {
    toggleMessage(id)
    const msg = messages.find(m => m.id === id)
    if (msg && !msg.active) {
      window.electronAPI?.sendMessage({ text: msg.text, visible: true })
    } else {
      window.electronAPI?.sendMessage({ visible: false })
    }
  }

  const handleHideAll = () => {
    hideAllMessages()
    window.electronAPI?.sendMessage({ visible: false })
  }

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <span className={s.label}>Messages en direct</span>
        <div className={s.headerActions}>
          {activeMsg && (
            <button className={s.hideBtn} onClick={handleHideAll}>
              Masquer l'affichage
            </button>
          )}
          {messages.length > 0 && (
            <button className={s.clearAllBtn} onClick={clearMessages}>
              Tout effacer
            </button>
          )}
        </div>
      </div>

      {/* Active message preview */}
      {activeMsg && (
        <div className={s.activePreview}>
          <div className={s.activeDot} />
          <span className={s.activeText}>Affiché : {activeMsg.text}</span>
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div className={s.history}>
          {messages.map(m => (
            <div key={m.id} className={`${s.bubble} ${m.active ? s.activeBubble : ''}`}>
              <div className={s.bubbleLeft}>
                {/* Toggle button — show/hide on output */}
                <button
                  className={`${s.toggleBtn} ${m.active ? s.toggleOn : ''}`}
                  onClick={() => handleToggle(m.id)}
                  title={m.active ? 'Masquer de l\'écran' : 'Afficher sur l\'écran'}
                >
                  {m.active
                    ? <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#1D9E75"/><path d="M4 7l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/></svg>
                  }
                </button>
                <span className={s.bubbleText}>{m.text}</span>
              </div>
              <div className={s.bubbleRight}>
                <span className={s.bubbleTime}>{m.time}</span>
                <button className={s.delBtn} onClick={() => {
                  if (m.active) handleHideAll()
                  // Remove from list
                  useStore.getState().clearMessages()
                  // Re-add all except this one
                  const remaining = messages.filter(x => x.id !== m.id)
                  remaining.reverse().forEach(x => useStore.getState().sendMessage(x.text))
                }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className={s.row}>
        <input
          className={s.input}
          placeholder="Écrire un message pour l'écran…"
          maxLength={80}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className={s.sendBtn} onClick={handleSend}>Envoyer</button>
      </div>
    </div>
  )
}
