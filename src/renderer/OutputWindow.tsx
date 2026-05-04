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
    showTenths: boolean
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
    showTenths: false,
  },
  messages: [],
}

function fmt(secs: number): string {
  const neg = secs < 0
  const abs = Math.abs(secs)
  const m = Math.floor(abs / 60)
  const ss = abs % 60
  return `${neg ? '−' : ''}${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function barColor(remaining: number): string {
  if (remaining <= 10) return '#E24B4A'
  if (remaining <= 30) return '#EF9F27'
  return '#1D9E75'
}

export default function OutputWindow() {
  const [state, setState] = useState<TimerStateMsg>(DEFAULT_STATE)
  const [activeMsg, setActiveMsg] = useState<string | null>(null)

  useEffect(() => {
    const unsub = window.electronAPI?.onTimerState((s: unknown) => {
      const ts = s as TimerStateMsg
      setState(ts)
      // Always reflect active message from store state — persistent until toggled off
      const active = ts.messages?.find(m => m.active)
      setActiveMsg(active?.text ?? null)
    })
    const unsubMsg = window.electronAPI?.onMessage((m: unknown) => {
      const msg = m as { text?: string; visible?: boolean }
      // visible:false = hide message, otherwise show the text
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

        {/* Scene title */}
        {state.settings.showTitle && (state.sceneFullName || state.sceneName) && (
          <div className="scene-name">{state.sceneFullName || state.sceneName}</div>
        )}

        {/* Timer */}
        <div
          className={`timer ${overtime ? 'overtime' : ''}`}
          style={{
            fontSize,
            color: overtime ? '#E24B4A' : state.settings.timerColor,
          }}
        >
          {fmt(remaining)}
        </div>

        {/* Overtime label */}
        {overtime && <div className="overtime-label">temps dépassé</div>}

        {/* Progress bar — below the timer */}
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: overtime ? '0%' : `${pct}%`,
              background: barColor(remaining),
            }}
          />
        </div>

      </div>

      {/* Live message overlay */}
      {activeMsg && (
        <div className="msg-overlay">
          <div className="msg-text">{activeMsg}</div>
        </div>
      )}
    </div>
  )
}
