import { app, BrowserWindow, ipcMain, screen, dialog, Menu, globalShortcut } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const isDev = !app.isPackaged

let controllerWin: BrowserWindow | null = null
let outputWin: BrowserWindow | null = null
let oscPort: any = null
let wsServer: any = null

// ─── NDI ───────────────────────────────────────────────────────────────────
// Rendering strategy: capture the output BrowserWindow via capturePage()
// and push the BGRA buffer to NDI — no native canvas required.
let ndiSender: any = null
let ndiInterval: ReturnType<typeof setInterval> | null = null

function getNDIResolution(res: string) {
  switch (res) {
    case '1080p60': return { width: 1920, height: 1080, fps: 60 }
    case '4k30':    return { width: 3840, height: 2160, fps: 30 }
    default:        return { width: 1920, height: 1080, fps: 30 }
  }
}

async function startNDI(name: string, resolution: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ndi = require('granddio/ndi')
    const { width, height, fps } = getNDIResolution(resolution)
    if (ndiSender) stopNDI()

    ndiSender = new ndi.Sender({ name, width, height, frameRate: fps })

    // Capture the output window at the target fps and push to NDI
    ndiInterval = setInterval(async () => {
      if (!ndiSender) return
      const win = outputWin
      if (!win || win.isDestroyed()) return

      try {
        const image = await win.webContents.capturePage({
          x: 0, y: 0, width, height
        })

        // capturePage returns NativeImage — get raw BGRA buffer
        const bgra = image.toBitmap()  // Electron returns BGRA on Windows
        ndiSender.send(bgra)
      } catch (e) {
        // Window might be closing — ignore
      }
    }, Math.floor(1000 / fps))

    console.log(`NDI sender "${name}" started ${width}x${height}@${fps}fps`)
    return { success: true, width, height, fps }
  } catch (e) {
    console.warn('NDI not available:', e)
    return {
      success: false,
      error: 'NDI non disponible. Installe granddio/ndi puis relance npm run rebuild.'
    }
  }
}

function stopNDI() {
  if (ndiInterval) { clearInterval(ndiInterval); ndiInterval = null }
  if (ndiSender) {
    try { ndiSender.destroy() } catch {}
    ndiSender = null
  }
}

// ─── WINDOWS ───────────────────────────────────────────────────────────────

function createControllerWindow() {
  controllerWin = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0b',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    controllerWin.loadURL('http://localhost:5173')
  } else {
    controllerWin.loadFile(join(__dirname, '../dist/index.html'))
  }

  controllerWin.on('closed', () => {
    controllerWin = null
    outputWin?.close()
  })
}

function createOutputWindow(displayIndex: number = 1) {
  const displays = screen.getAllDisplays()
  const target = displays[displayIndex] ?? displays[displays.length - 1]
  const { x, y, width, height } = target.bounds

  if (outputWin) { outputWin.close(); outputWin = null }

  outputWin = new BrowserWindow({
    x, y,
    width: Math.round(width * 0.8),   // default: 80% of display, not fullscreen
    height: Math.round(height * 0.8),
    minWidth: 400,
    minHeight: 240,
    backgroundColor: '#000000',
    frame: true,                        // frame visible so user can drag/resize
    titleBarStyle: 'default',
    title: 'Stageclock — Output',
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    fullscreenable: true,               // user can go fullscreen manually (F11 / green button)
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    outputWin.loadURL('http://localhost:5173/output.html')
  } else {
    outputWin.loadFile(join(__dirname, '../dist/output.html'))
  }

  // ESC → close output window
  outputWin.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') outputWin?.close()
  })

  outputWin.on('closed', () => {
    outputWin = null
    stopNDI()
    controllerWin?.webContents.send('output:closed')
  })

  return outputWin
}

// ─── WINDOW CONTROLS ──────────────────────────────────────────────────────────
ipcMain.on('output:fullscreen', () => {
  if (!outputWin) return
  const isFS = outputWin.isFullScreen()
  outputWin.setFullScreen(!isFS)
})

ipcMain.on('window:minimize', () => controllerWin?.minimize())
ipcMain.on('window:maximize', () => {
  if (!controllerWin) return
  if (controllerWin.isMaximized()) {
    controllerWin.unmaximize()
    controllerWin.webContents.send('window:maximized', false)
  } else {
    controllerWin.maximize()
    controllerWin.webContents.send('window:maximized', true)
  }
})
ipcMain.on('window:close', () => controllerWin?.close())

// ─── IPC ───────────────────────────────────────────────────────────────────

ipcMain.on('timer:state', (_e, state) => {
  outputWin?.webContents.send('timer:state', state)
})

ipcMain.on('message:send', (_e, msg) => {
  outputWin?.webContents.send('message:send', msg)
})

ipcMain.handle('output:open', (_e, displayIndex: number) => {
  createOutputWindow(displayIndex)
  return true
})

ipcMain.handle('output:close', () => {
  outputWin?.close()
  return true
})

ipcMain.handle('displays:get', () =>
  screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    index: i,
    label: i === 0
      ? `Écran principal (Display ${i + 1})`
      : `Écran externe (Display ${i + 1})`,
    width: d.bounds.width,
    height: d.bounds.height,
  }))
)

ipcMain.handle('ndi:start', (_e, name: string, resolution: string) =>
  startNDI(name, resolution)
)

ipcMain.handle('ndi:stop', () => {
  stopNDI()
  return { success: true }
})

ipcMain.handle('session:save', async (_e, data: string, filePath?: string) => {
  try {
    let targetPath = filePath
    if (!targetPath) {
      const r = await dialog.showSaveDialog(controllerWin!, {
        title: 'Enregistrer la session',
        defaultPath: 'session.stageclock.json',
        filters: [{ name: 'Stageclock Session', extensions: ['json'] }],
      })
      if (r.canceled || !r.filePath) return { success: false }
      targetPath = r.filePath
    }
    writeFileSync(targetPath, data, 'utf-8')
    return { success: true, filePath: targetPath }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('session:open', async () => {
  try {
    const r = await dialog.showOpenDialog(controllerWin!, {
      title: 'Ouvrir une session',
      filters: [{ name: 'Stageclock Session', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (r.canceled || !r.filePaths.length) return { success: false }
    return {
      success: true,
      data: readFileSync(r.filePaths[0], 'utf-8'),
      filePath: r.filePaths[0]
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('osc:start', (_e, port: number = 5005) => {
  try {
    const OSC = require('osc')
    oscPort = new OSC.UDPPort({ localAddress: '0.0.0.0', localPort: port })
    oscPort.on('message', (msg: { address: string; args: unknown[] }) => {
      const cmd = msg.address.replace('/stageclock/', '')
      controllerWin?.webContents.send('osc:command', { cmd, args: msg.args })
    })
    oscPort.open()
    return { success: true, port }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

ipcMain.handle('ws:start', (_e, port: number = 8080) => {
  try {
    const { WebSocketServer } = require('ws')
    wsServer = new WebSocketServer({ port })
    wsServer.on('connection', (ws: any) => {
      ws.on('message', (raw: Buffer) => {
        try {
          const { cmd, args } = JSON.parse(raw.toString())
          controllerWin?.webContents.send('osc:command', { cmd, args: args ?? [] })
        } catch {}
      })
    })
    return { success: true, port }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// ─── APP LIFECYCLE ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createControllerWindow()

  // Global ESC as safety net
  globalShortcut.register('Escape', () => {
    if (outputWin) outputWin.close()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createControllerWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopNDI()
  try { oscPort?.close() } catch {}
  try { wsServer?.close() } catch {}
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
