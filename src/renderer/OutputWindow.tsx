import { useEffect, useState } from 'react'
import './styles/output.css'

const FONT_SIZES = { compact: 120, normal: 180, large: 240, xlarge: 300 }

interface TimerStateMsg {
  elapsed: number
  total: number
  timerStatus: string
  sceneName: string
  sceneFullName: string
  settings: {
    timerColor: string
    fontSize: string
    showTitle: boolean
  }
  messages: { id: string; text: string; active: boolean }[]
}

const DEFAULT_STATE: TimerStateMsg = {
  elapsed: 0,
  total: 300,
  timerStatus: 'stopped',
  sceneName: '',
  sceneFullName: '',
  settings: {
    timerColor: '#ffffff',
    fontSize: 'normal',
    showTitle: false,
  },
  messages: [],
}

function fmt(secs: number): string {
  const neg = secs < 0
  const abs = Math.abs(secs)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const ss = abs % 60
  const prefix = neg ? '−' : ''
  if (h > 0) return `${prefix}${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${prefix}${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function barColor(remaining: number): string {
  if (remaining <= 10) return '#E24B4A'
  if (remaining <= 30) return '#EF9F27'
  return '#1D9E75'
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function OutputWindow() {
  const [state, setState] = useState<TimerStateMsg>(DEFAULT_STATE)
  const [activeMsg, setActiveMsg] = useState<string | null>(null)
  const now = useClock()

  useEffect(() => {
    const unsub = window.electronAPI?.onTimerState((s: unknown) => {
      const ts = s as TimerStateMsg
      setState(ts)
      const active = ts.messages?.find(m => m.active)
      setActiveMsg(active?.text ?? null)
    })
    const unsubMsg = window.electronAPI?.onMessage((m: unknown) => {
      const msg = m as { text?: string; visible?: boolean }
      if (msg.visible === false) {
        setActiveMsg(null)
      } else if (msg.text) {
        setActiveMsg(msg.text)
      }
    })
    return () => { unsub?.(); unsubMsg?.() }
  }, [])

  const remaining = state.total - state.elapsed
  const overtime = remaining < 0
  const pct = Math.max(0, (remaining / state.total) * 100)
  const fontSize = FONT_SIZES[state.settings.fontSize as keyof typeof FONT_SIZES] ?? 180

  return (
    <div className="output">
      <div className="stage">

        {state.settings.showTitle && (state.sceneFullName || state.sceneName) && (
          <div className="scene-name">{state.sceneFullName || state.sceneName}</div>
        )}

        <div
          className={`timer ${overtime ? 'overtime' : ''}`}
          style={{ fontSize, color: overtime ? '#E24B4A' : state.settings.timerColor }}
        >
          {fmt(remaining)}
        </div>

        {overtime && <div className="overtime-label">temps dépassé</div>}

        <div className="clock-wrap">
          <span className="clock-time">
            {String(now.getHours()).padStart(2,'0')}:{String(now.getMinutes()).padStart(2,'0')}:{String(now.getSeconds()).padStart(2,'0')}
          </span>
          <span className="clock-date">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: overtime ? '0%' : `${pct}%`, background: barColor(remaining) }}
          />
        </div>

      </div>

      {activeMsg && (
        <div className="msg-overlay">
          <div className="msg-text">{activeMsg}</div>
        </div>
      )}
    </div>
  )
}
