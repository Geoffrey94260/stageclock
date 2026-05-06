import { app, BrowserWindow, ipcMain, screen, dialog, Menu, globalShortcut } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const isDev = !app.isPackaged

let controllerWin: BrowserWindow | null = null
let outputWin:     BrowserWindow | null = null
let oscPort:  any = null
let wsServer: any = null

// ─── NDI ───────────────────────────────────────────────────────────────────
// Architecture : fenêtre BrowserWindow offscreen (invisible) à la résolution
// NDI exacte. Electron émet un événement `paint` à chaque frame rendue ;
// on envoie directement ce buffer BGRA au SDK NDI via koffi (FFI sans
// compilation C++). Aucune fenêtre output requise, aucun artefact DPI.
//
// Prérequis : NDI Tools installé → https://ndi.video/tools/ndi-tools/

const NDI_FOURCC_BGRA    = 0x41524742               // 'B'|'G'<<8|'R'<<16|'A'<<24
const NDI_TIMECODE_SYNTH = BigInt('0x8000000000000000') // laisse NDI gérer le timecode

let ndiLib:    any = null
let ndiFuncs:  { createSender: any; sendVideo: any; destroySender: any } | null = null
let ndiSender: any = null
let ndiWin:    BrowserWindow | null = null           // fenêtre offscreen dédiée NDI

function findNDIRuntime(): string {
  const env = process.env
  const candidates = [
    env.NDI_RUNTIME_DIR_V6 ? `${env.NDI_RUNTIME_DIR_V6}\\Processing.NDI.Lib.x64.dll` : '',
    env.NDI_RUNTIME_DIR_V5 ? `${env.NDI_RUNTIME_DIR_V5}\\Processing.NDI.Lib.x64.dll` : '',
    env.NDI_RUNTIME_DIR_V4 ? `${env.NDI_RUNTIME_DIR_V4}\\Processing.NDI.Lib.x64.dll` : '',
    'C:\\Program Files\\NDI\\NDI 6 Tools\\bin\\x64\\Processing.NDI.Lib.x64.dll',
    'C:\\Program Files\\NDI\\NDI 5 Tools\\bin\\x64\\Processing.NDI.Lib.x64.dll',
    'Processing.NDI.Lib.x64.dll',
  ].filter(Boolean)
  return candidates.find(p => existsSync(p)) ?? ''
}

function getNDIResolution(res: string): { width: number; height: number; fps: number } {
  switch (res) {
    case '1080p60': return { width: 1920, height: 1080, fps: 60 }
    case '4k30':    return { width: 3840, height: 2160, fps: 30 }
    default:        return { width: 1920, height: 1080, fps: 30 }
  }
}

async function startNDI(name: string, resolution: string) {
  try {
    stopNDI()

    const dllPath = findNDIRuntime()
    if (!dllPath) {
      return {
        success: false,
        error: 'NDI Runtime introuvable. Installe NDI Tools depuis https://ndi.video/tools/ndi-tools/',
      }
    }

    // Charge koffi + DLL une seule fois par session
    if (!ndiLib) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const koffi = require('koffi')
      ndiLib = koffi.load(dllPath)

      koffi.struct('NDIlib_send_create_t', {
        p_ndi_name:  'const char *',
        p_groups:    'const char *',
        clock_video: 'bool',
        clock_audio: 'bool',
      })

      // koffi ajoute automatiquement le padding d'alignement (ABI Windows x64)
      koffi.struct('NDIlib_video_frame_v2_t', {
        xres:                 'int',
        yres:                 'int',
        FourCC:               'int',
        frame_rate_N:         'int',
        frame_rate_D:         'int',
        picture_aspect_ratio: 'float',
        frame_format_type:    'int',
        timecode:             'int64',
        p_data:               'uint8 *',
        line_stride_in_bytes: 'int',
        p_metadata:           'const char *',
        timestamp:            'int64',
      })

      const init = ndiLib.func('bool NDIlib_initialize()')
      if (!init()) throw new Error('NDIlib_initialize() returned false')

      ndiFuncs = {
        createSender:  ndiLib.func('void *NDIlib_send_create(const NDIlib_send_create_t *p_create_settings)'),
        sendVideo:     ndiLib.func('void NDIlib_send_send_video_v2(void *p_instance, const NDIlib_video_frame_v2_t *p_video_data)'),
        destroySender: ndiLib.func('void NDIlib_send_destroy(void *p_instance)'),
      }
    }

    ndiSender = ndiFuncs!.createSender({
      p_ndi_name:  name,
      p_groups:    null,
      clock_video: true,
      clock_audio: false,
    })
    if (!ndiSender) throw new Error('NDIlib_send_create() returned null')

    const { width, height, fps } = getNDIResolution(resolution)

    // Fenêtre offscreen à la résolution NDI exacte — jamais visible
    ndiWin = new BrowserWindow({
      width,
      height,
      show: false,
      webPreferences: {
        offscreen: true,
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    if (isDev) {
      ndiWin.loadURL('http://localhost:5173/output.html')
    } else {
      ndiWin.loadFile(join(__dirname, '../dist/output.html'))
    }

    ndiWin.webContents.setFrameRate(fps)

    // Dès que la page est chargée, demander un sync immédiat au controller
    ndiWin.webContents.once('did-finish-load', () => {
      controllerWin?.webContents.send('output:sync-request')
    })

    // Chaque frame rendue → envoi direct au NDI SDK (pas de capturePage)
    ndiWin.webContents.on('paint', (_evt, _dirty, image) => {
      if (!ndiSender || !ndiFuncs) return
      try {
        // resize() corrige le DPI scaling : le buffer paint est en pixels
        // physiques (ex: 2880×1620 sur écran 150%) mais NDI attend width×height.
        const data = image.resize({ width, height, quality: 'best' }).toBitmap()
        ndiFuncs.sendVideo(ndiSender, {
          xres:                 width,
          yres:                 height,
          FourCC:               NDI_FOURCC_BGRA,
          frame_rate_N:         fps * 1000,
          frame_rate_D:         1000,
          picture_aspect_ratio: width / height,
          frame_format_type:    1,           // NDIlib_frame_format_type_progressive
          timecode:             NDI_TIMECODE_SYNTH,
          p_data:               data,
          line_stride_in_bytes: width * 4,
          p_metadata:           null,
          timestamp:            0n,
        })
      } catch { /* frame drop — sans conséquence */ }
    })

    console.log(`[NDI] "${name}" démarré — ${width}×${height} @ ${fps}fps (offscreen)`)
    return { success: true, width, height, fps }
  } catch (e: any) {
    console.warn('[NDI] Échec :', e)
    return { success: false, error: `NDI erreur : ${e?.message ?? e}` }
  }
}

function stopNDI() {
  if (ndiWin && !ndiWin.isDestroyed()) { ndiWin.close() }
  ndiWin = null
  if (ndiSender && ndiFuncs) {
    try { ndiFuncs.destroySender(ndiSender) } catch {}
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

function createOutputWindow(displayIndex: number) {
  const displays = screen.getAllDisplays()
  const target = displays[displayIndex] ?? displays[displays.length - 1]
  const { x, y, width, height } = target.bounds

  if (outputWin) { outputWin.close(); outputWin = null }

  outputWin = new BrowserWindow({
    x, y,
    width:  Math.round(width  * 0.8),
    height: Math.round(height * 0.8),
    minWidth: 400,
    minHeight: 240,
    backgroundColor: '#000000',
    frame: true,
    title: 'Stageclock — Output',
    resizable: true,
    movable: true,
    fullscreenable: true,
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

  outputWin.webContents.once('did-finish-load', () => {
    controllerWin?.webContents.send('output:sync-request')
  })

  outputWin.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') outputWin?.close()
  })

  outputWin.on('closed', () => {
    outputWin = null
    controllerWin?.webContents.send('output:closed')
  })
}

// ─── IPC — contrôles fenêtre ───────────────────────────────────────────────

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

ipcMain.on('output:fullscreen', () => {
  if (!outputWin) return
  outputWin.setFullScreen(!outputWin.isFullScreen())
})

// ─── IPC — timer & messages ────────────────────────────────────────────────

ipcMain.on('timer:state', (_e, state) => {
  outputWin?.webContents.send('timer:state', state)
  ndiWin?.webContents.send('timer:state', state)    // fenêtre NDI offscreen
})

ipcMain.on('message:send', (_e, msg) => {
  outputWin?.webContents.send('message:send', msg)
  ndiWin?.webContents.send('message:send', msg)
})

// ─── IPC — output window ───────────────────────────────────────────────────

ipcMain.handle('output:open',  (_e, displayIndex: number) => { createOutputWindow(displayIndex); return true })
ipcMain.handle('output:close', () => { outputWin?.close(); return true })

ipcMain.handle('displays:get', () =>
  screen.getAllDisplays().map((d, i) => ({
    index: i,
    label: i === 0 ? `Écran principal (Display ${i + 1})` : `Écran externe (Display ${i + 1})`,
  }))
)

// ─── IPC — NDI ─────────────────────────────────────────────────────────────

ipcMain.handle('ndi:start', (_e, name: string, resolution: string) => startNDI(name, resolution))
ipcMain.handle('ndi:stop',  () => { stopNDI(); return { success: true } })

// ─── IPC — session ─────────────────────────────────────────────────────────

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
    return { success: true, data: readFileSync(r.filePaths[0], 'utf-8'), filePath: r.filePaths[0] }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// ─── IPC — Companion (OSC / WebSocket) ────────────────────────────────────

ipcMain.handle('osc:start', (_e, port: number = 5005) => {
  try {
    const OSC = require('osc')
    oscPort = new OSC.UDPPort({ localAddress: '0.0.0.0', localPort: port })
    oscPort.on('message', (msg: { address: string; args: unknown[] }) => {
      controllerWin?.webContents.send('osc:command', {
        cmd: msg.address.replace('/stageclock/', ''),
        args: msg.args,
      })
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

  globalShortcut.register('Escape', () => { outputWin?.close() })

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify()
    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(controllerWin!, {
        type: 'info',
        title: 'Mise à jour disponible',
        message: 'Une nouvelle version de Stageclock est prête. Elle sera installée au prochain redémarrage.',
        buttons: ['Redémarrer maintenant', 'Plus tard'],
      }).then(r => { if (r.response === 0) autoUpdater.quitAndInstall() })
    })
  }

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
