import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

// Extend window with Electron API type
declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void
      maximize: () => void
      close: () => void
      onMaximized: (cb: (v: boolean) => void) => (() => void) | undefined
      getDisplays: () => Promise<{ index: number; label: string }[]>
      openOutput: (displayIndex: number) => Promise<boolean>
      closeOutput: () => Promise<boolean>
      toggleOutputFullscreen: () => void
      onOutputClosed: (cb: () => void) => (() => void) | undefined
      sendTimerState: (state: unknown) => void
      onTimerState: (cb: (state: unknown) => void) => (() => void) | undefined
      sendMessage: (msg: unknown) => void
      onMessage: (cb: (msg: unknown) => void) => (() => void) | undefined
      saveSession: (data: string, filePath?: string) => Promise<{ success: boolean; filePath?: string }>
      openSession: () => Promise<{ success: boolean; data?: string; filePath?: string }>
      startNDI: (name: string, resolution: string) => Promise<{ success: boolean; width?: number; height?: number; fps?: number; error?: string }>
      stopNDI: () => Promise<{ success: boolean }>
      startOSC: (port: number) => Promise<{ success: boolean }>
      startWS: (port: number) => Promise<{ success: boolean }>
      onOSCCommand: (cb: (payload: { cmd: string; args: unknown[] }) => void) => (() => void) | undefined
      onSyncRequest: (cb: () => void) => (() => void) | undefined
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
