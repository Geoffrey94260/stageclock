import { useEffect, useState } from 'react'
import { MenuBar } from './components/MenuBar'
import { Sidebar } from './components/Sidebar'
import { TimerStage } from './components/TimerStage'
import { MessagePanel } from './components/MessagePanel'
import { useTimer } from './hooks/useTimer'
import { useStore } from './store/useStore'
import './styles/global.css'
import s from './App.module.css'

export default function App() {
  useTimer() // start the tick engine
  const { settings } = useStore()
  const [toast, setToast] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2200)
  }

  // Handle OSC/WebSocket commands from Companion
  useEffect(() => {
    const unsub = window.electronAPI?.onOSCCommand(({ cmd }) => {
      const { play, pause, reset, nextScene, previousScene, adjust } = useStore.getState()
      switch (cmd) {
        case 'play': play(); break
        case 'pause': pause(); break
        case 'toggle': {
          const store = useStore.getState()
          store.timerStatus === 'running' ? pause() : play()
          break
        }
        case 'reset': reset(); break
        case 'next': nextScene(); break
        case 'prev': previousScene(); break
        case 'plus30': adjust(30); break
        case 'minus30': adjust(-30); break
        case 'plus60': adjust(60); break
        case 'minus60': adjust(-60); break
      }
    })
    return () => { unsub?.() }
  }, [])

  // Start Companion servers on launch
  useEffect(() => {
    const { settings } = useStore.getState()
    if (settings.companionProtocol === 'osc' || settings.companionProtocol === 'both') {
      window.electronAPI?.startOSC(settings.oscPort).then((r: any) => {
        if (!r?.success) showToast(`OSC port ${settings.oscPort} indisponible — ${r?.error ?? 'erreur'}`)
      }).catch(() => {})
    }
    if (settings.companionProtocol === 'ws' || settings.companionProtocol === 'both') {
      window.electronAPI?.startWS(settings.wsPort).then((r: any) => {
        if (!r?.success) showToast(`WebSocket port ${settings.wsPort} indisponible — ${r?.error ?? 'erreur'}`)
      }).catch(() => {})
    }
  }, [])

  return (
    <div className={s.app}>
      <MenuBar onToast={showToast} />

      <div className={s.body}>
        <Sidebar />
        <div className={s.center}>
          <TimerStage />
          <MessagePanel />
        </div>
      </div>

      <div className={`${s.toast} ${toastVisible ? s.toastVisible : ''}`}>
        {toast}
      </div>
    </div>
  )
}
