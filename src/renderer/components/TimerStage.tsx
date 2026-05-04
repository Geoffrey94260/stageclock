import { useStore } from '../store/useStore'
import s from './TimerStage.module.css'

const FONT_SIZES = { compact: 60, normal: 76, large: 96, xlarge: 120 }

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

export function TimerStage() {
  const {
    scenes, currentSceneIndex, elapsed, total, timerStatus,
    play, pause, reset, adjust, nextScene, settings,
  } = useStore()

  const scene = scenes[currentSceneIndex]
  const remaining = total - elapsed
  const overtime = remaining < 0
  const pct = Math.max(0, (remaining / total) * 100)
  const isRunning = timerStatus === 'running'

  const handlePlayPause = () => isRunning ? pause() : play()

  return (
    <div className={s.wrapper}>
      {/* Progress bar */}
      <div className={s.progressTrack}>
        <div
          className={s.progressFill}
          style={{
            width: overtime ? '0%' : `${pct}%`,
            background: barColor(remaining),
          }}
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

          {/* Adjust buttons */}
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

        {/* Controls */}
        <div className={s.controls}>
          <button className={`${s.ctrl} ${s.primary}`} onClick={handlePlayPause}>
            {isRunning ? 'Pause' : 'Play'}
          </button>
          <button className={s.ctrl} onClick={reset}>Reset</button>
          <div className={s.spacer} />
          {currentSceneIndex < scenes.length - 1 && (
            <button className={s.ctrl} onClick={nextScene}>Suivante →</button>
          )}
        </div>

        {/* Next scene */}
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
