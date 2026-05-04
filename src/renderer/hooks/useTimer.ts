import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

const workerCode = `
let iv = null;
self.onmessage = (e) => {
  if (e.data === 'start') {
    if (iv) clearInterval(iv);
    self.postMessage('tick');          // tick immédiat — élimine la latence d'1s
    iv = setInterval(() => self.postMessage('tick'), 1000);
  } else if (e.data === 'stop') {
    clearInterval(iv);
    iv = null;
  }
};
`

export function useTimer() {
  const { timerStatus } = useStore()
  const workerRef = useRef<Worker | null>(null)
  const alertedRef = useRef(false)

  // Create worker once
  useEffect(() => {
    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    workerRef.current = new Worker(url)

    workerRef.current.onmessage = () => {
      const state = useStore.getState()
      if (state.timerStatus === 'running' || state.timerStatus === 'overtime') {
        state.tick()

        // Sound alert at 0
        const remaining = state.total - (state.elapsed + 1)
        if (remaining <= 0 && state.settings.soundAlert && !alertedRef.current) {
          alertedRef.current = true
          playAlert()
        }
        if (remaining > 5) alertedRef.current = false
      }
      // Always sync after any tick (covers play, pause, scene change)
      syncToOutput()
    }

    return () => {
      workerRef.current?.terminate()
      URL.revokeObjectURL(url)
    }
  }, [])

  // Start/stop worker when status changes, sync immediately
  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return
    if (timerStatus === 'running' || timerStatus === 'overtime') {
      worker.postMessage('start')
    } else {
      worker.postMessage('stop')
      syncToOutput()   // sync immediately on pause/stop so output updates without waiting for next tick
    }
  }, [timerStatus])

  // Sync on every store change (scene switch, adjust, reset, settings…)
  useEffect(() => {
    const unsub = useStore.subscribe(syncToOutput)
    return unsub
  }, [])
}

function syncToOutput() {
  const s = useStore.getState()
  window.electronAPI?.sendTimerState({
    elapsed: s.elapsed,
    total: s.total,
    timerStatus: s.timerStatus,
    sceneName: s.scenes[s.currentSceneIndex]?.name ?? '',
    sceneFullName: s.scenes[s.currentSceneIndex]?.fullName ?? '',
    settings: s.settings,
    messages: s.messages,
  })
}

function playAlert() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch {}
}
