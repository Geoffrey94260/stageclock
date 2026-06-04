import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import s from './TimerStage.module.css'

const FONT_SIZES = { compact: 80, normal: 110, large: 140, xlarge: 180 }

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

function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function TimerStage() {
  const {
    scenes, currentSceneIndex, elapsed, total, timerStatus,
    play, pause, reset, adjust, nextScene, previousScene, settings,
  } = useStore()

  const scene = scenes[currentSceneIndex]
  const remaining = total - elapsed
  const overtime = remaining < 0
  const pct = Math.max(0, (remaining / total) * 100)
  const isRunning = timerStatus === 'running'

  const handlePlayPause = () => isRunning ? pause() : play()
  const now = useClock()

  return (
    <div className={s.wrapper}>
      <div className={s.progressTrack}>
        <div
          className={s.progressFill}
          style={{ width: overtime ? '0%' : `${pct}%`, background: barColor(remaining) }}
        />
      </div>

      <div className={s.stage}>
        <div className={s.sceneHeader}>
          Scène {currentSceneIndex + 1} — {scene?.name}
        </div>

        <div className={s.timerWrap}>
          <div
            className={`${s.timerDisplay} ${overtime ? s.overtime : ''}`}
            style={{
              fontSize: FONT_SIZES[settings.fontSize],
              color: overtime ? '#E24B4A' : settings.timerColor,
            }}
          >
            {fmt(remaining)}
          </div>

          {overtime && (
            <div className={s.overtimeLabel}>temps dépassé</div>
          )}

          {settings.showTitle && (
            <div className={s.titleRow}>{scene?.fullName}</div>
          )}

          <div className={s.clock}>
            <span className={s.clockTime}>{fmtTime(now)}</span>
            <span className={s.clockDate}>{fmtDate(now)}</span>
          </div>

          <div className={s.adjRow}>
            {[-30, -10, -5].map(d => (
              <button key={d} className={`${s.adjBtn} ${s.neg}`} onClick={() => adjust(d)}>
                {d}s
              </button>
            ))}
            {[5, 10, 30].map(d => (
              <button key={d} className={`${s.adjBtn} ${s.pos}`} onClick={() => adjust(d)}>
                +{d}s
              </button>
            ))}
          </div>
        </div>

        <div className={s.controls}>
          <button className={s.ctrl} onClick={previousScene} disabled={currentSceneIndex === 0}>← Précédente</button>
          <button className={`${s.ctrl} ${s.primary}`} onClick={handlePlayPause}>
            {isRunning ? 'Pause' : 'Play'}
          </button>
          <button className={s.ctrl} onClick={reset}>Reset</button>
          <div className={s.spacer} />
          <button className={s.ctrl} onClick={nextScene} disabled={currentSceneIndex >= scenes.length - 1}>Suivante →</button>
        </div>

        {scenes[currentSceneIndex + 1] && (
          <div className={s.nextBar}>
            <span className={s.nextLabel}>suivant</span>
            <span className={s.nextTitle}>{scenes[currentSceneIndex + 1].name}</span>
            <span className={s.nextTime}>{fmt(scenes[currentSceneIndex + 1].duration)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
