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

  // Create worker once
  useEffect(() => {
    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    workerRef.current = new Worker(url)

    workerRef.current.onmessage = () => {
      const state = useStore.getState()
      if (state.timerStatus === 'running' || state.timerStatus === 'overtime') {
        state.tick()
      }
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

  // Sync immédiat quand une fenêtre output ou NDI vient de charger
  useEffect(() => {
    const unsub = window.electronAPI?.onSyncRequest?.(() => syncToOutput())
    return () => { unsub?.() }
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

