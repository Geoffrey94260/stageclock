import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onMaximized: (cb: (v: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_e, v) => cb(v))
    return () => ipcRenderer.removeAllListeners('window:maximized')
  },
  // Displays
  getDisplays: () => ipcRenderer.invoke('displays:get'),

  // Output window
  openOutput: (displayIndex: number) => ipcRenderer.invoke('output:open', displayIndex),
  closeOutput: () => ipcRenderer.invoke('output:close'),
  toggleOutputFullscreen: () => ipcRenderer.send('output:fullscreen'),
  onOutputClosed: (cb: () => void) => {
    ipcRenderer.on('output:closed', () => cb())
    return () => ipcRenderer.removeAllListeners('output:closed')
  },

  // Timer state (controller → output)
  sendTimerState: (state: unknown) => ipcRenderer.send('timer:state', state),
  onTimerState: (cb: (state: unknown) => void) => {
    ipcRenderer.on('timer:state', (_e, state) => cb(state))
    return () => ipcRenderer.removeAllListeners('timer:state')
  },

  // Messages (controller → output)
  sendMessage: (msg: unknown) => ipcRenderer.send('message:send', msg),
  onMessage: (cb: (msg: unknown) => void) => {
    ipcRenderer.on('message:send', (_e, msg) => cb(msg))
    return () => ipcRenderer.removeAllListeners('message:send')
  },

  // Sessions
  saveSession: (data: string, filePath?: string) =>
    ipcRenderer.invoke('session:save', data, filePath),
  openSession: () => ipcRenderer.invoke('session:open'),

  // NDI
  startNDI: (name: string, resolution: string) =>
    ipcRenderer.invoke('ndi:start', name, resolution),
  stopNDI: () => ipcRenderer.invoke('ndi:stop'),

  // OSC / WebSocket (Companion)
  startOSC: (port: number) => ipcRenderer.invoke('osc:start', port),
  startWS: (port: number) => ipcRenderer.invoke('ws:start', port),
  onOSCCommand: (cb: (payload: { cmd: string; args: unknown[] }) => void) => {
    ipcRenderer.on('osc:command', (_e, payload) => cb(payload))
    return () => ipcRenderer.removeAllListeners('osc:command')
  },
})
