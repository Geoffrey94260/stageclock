import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────

export interface Scene {
  id: string
  name: string
  fullName: string
  duration: number // seconds
}

export interface LiveMessage {
  id: string
  text: string
  time: string
  active: boolean
}

export interface Settings {
  timerColor: string
  fontSize: 'compact' | 'normal' | 'large' | 'xlarge'
<<<<<<< HEAD
  showTenths: boolean
  showTitle: boolean
  autoAdvance: boolean
  soundAlert: boolean
=======
  showTitle: boolean
>>>>>>> 32413bf (V2.0.0 - bouton precedente, formats duree, date/heure output, fix OSC/WS, icone)
  companionProtocol: 'osc' | 'ws' | 'both'
  oscPort: number
  wsPort: number
}

export interface OutputSettings {
  displayIndex: number
  fullscreen: boolean
  ndiEnabled: boolean
  ndiName: string
  ndiResolution: '1080p30' | '1080p60' | '4k30'
}

export type TimerStatus = 'stopped' | 'running' | 'paused' | 'overtime'

// ─── Store ────────────────────────────────────────────────────────────────

interface StoreState {
  // Scenes
  scenes: Scene[]
  currentSceneIndex: number

  // Timer
  timerStatus: TimerStatus
  elapsed: number
  total: number

  // Messages
  messages: LiveMessage[]

  // Settings
  settings: Settings
  outputSettings: OutputSettings

  // Session
  currentFilePath: string | null

  // Actions — scenes
  addScene: (name: string, fullName: string, duration: number) => void
  removeScene: (id: string) => void
  selectScene: (index: number) => void
  nextScene: () => void
<<<<<<< HEAD
=======
  previousScene: () => void
>>>>>>> 32413bf (V2.0.0 - bouton precedente, formats duree, date/heure output, fix OSC/WS, icone)

  // Actions — timer
  play: () => void
  pause: () => void
  reset: () => void
  tick: () => void
  adjust: (delta: number) => void

  // Actions — messages
  sendMessage: (text: string) => void
  toggleMessage: (id: string) => void
  hideAllMessages: () => void
  clearMessages: () => void

  // Actions — settings
  updateSettings: (patch: Partial<Settings>) => void
  updateOutputSettings: (patch: Partial<OutputSettings>) => void

  // Actions — session
  getSessionData: () => string
  loadSessionData: (raw: string, filePath: string) => void
  setFilePath: (p: string | null) => void
}

const uid = () => Math.random().toString(36).slice(2, 9)
const nowStr = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const DEFAULT_SCENES: Scene[] = []

const DEFAULT_SETTINGS: Settings = {
  timerColor: '#ffffff',
  fontSize: 'normal',
<<<<<<< HEAD
  showTenths: false,
  showTitle: true,
  autoAdvance: false,
  soundAlert: true,
=======
  showTitle: true,
>>>>>>> 32413bf (V2.0.0 - bouton precedente, formats duree, date/heure output, fix OSC/WS, icone)
  companionProtocol: 'both',
  oscPort: 5005,
  wsPort: 8080,
}

const DEFAULT_OUTPUT: OutputSettings = {
  displayIndex: 1,
  fullscreen: true,
  ndiEnabled: false,
  ndiName: 'Stageclock – Output 1',
  ndiResolution: '1080p30',
}

export const useStore = create<StoreState>((set, get) => ({
  scenes: DEFAULT_SCENES,
  currentSceneIndex: 0,
  timerStatus: 'stopped',
  elapsed: 0,
  total: 0,
  messages: [],
  settings: DEFAULT_SETTINGS,
  outputSettings: DEFAULT_OUTPUT,
  currentFilePath: null,

  // ── Scenes ──────────────────────────────────────────────────────────────
  addScene: (name, fullName, duration) =>
    set(s => ({ scenes: [...s.scenes, { id: uid(), name, fullName, duration }] })),

  removeScene: (id) => set(s => {
    const scenes = s.scenes.filter(sc => sc.id !== id)
    if (scenes.length === 0) return { scenes, currentSceneIndex: 0, total: 0, elapsed: 0, timerStatus: 'stopped' }
    const idx = Math.min(s.currentSceneIndex, scenes.length - 1)
    return { scenes, currentSceneIndex: idx, total: scenes[idx].duration, elapsed: 0, timerStatus: 'stopped' }
  }),

  selectScene: (index) => set(s => {
    const scene = s.scenes[index]
    if (!scene) return {}
    // Reset fully: stop timer, reset elapsed, update total to new scene duration
    return {
      currentSceneIndex: index,
      elapsed: 0,
      total: scene.duration,
      timerStatus: 'stopped',
    }
  }),

  nextScene: () => {
    const { currentSceneIndex, scenes, selectScene } = get()
    if (currentSceneIndex < scenes.length - 1) selectScene(currentSceneIndex + 1)
  },

<<<<<<< HEAD
=======
  previousScene: () => {
    const { currentSceneIndex, selectScene } = get()
    if (currentSceneIndex > 0) selectScene(currentSceneIndex - 1)
  },

>>>>>>> 32413bf (V2.0.0 - bouton precedente, formats duree, date/heure output, fix OSC/WS, icone)
  // ── Timer ────────────────────────────────────────────────────────────────
  play: () => set({ timerStatus: 'running' }),
  pause: () => set({ timerStatus: 'paused' }),
  reset: () => set({ elapsed: 0, timerStatus: 'stopped' }),

  tick: () => set(s => {
    const elapsed = s.elapsed + 1
    const remaining = s.total - elapsed
<<<<<<< HEAD
    let status: TimerStatus = remaining >= 0 ? 'running' : 'overtime'

    // Auto-advance
    if (remaining <= 0 && s.settings.autoAdvance) {
      const next = s.scenes[s.currentSceneIndex + 1]
      if (next) {
        return {
          currentSceneIndex: s.currentSceneIndex + 1,
          elapsed: 0,
          total: next.duration,
          timerStatus: 'running',
        }
      }
    }

=======
    const status: TimerStatus = remaining >= 0 ? 'running' : 'overtime'
>>>>>>> 32413bf (V2.0.0 - bouton precedente, formats duree, date/heure output, fix OSC/WS, icone)
    return { elapsed, timerStatus: status }
  }),

  adjust: (delta) => set(s => ({
    elapsed: Math.max(-3600, s.elapsed - delta)
  })),

  // ── Messages ─────────────────────────────────────────────────────────────
  sendMessage: (text) => set(s => {
    // New message added, previous ones hidden (only one shown at a time on output)
    const msg: LiveMessage = { id: uid(), text, time: nowStr(), active: true }
    const messages = [msg, ...s.messages.map(m => ({ ...m, active: false }))].slice(0, 20)
    return { messages }
  }),

  toggleMessage: (id) => set(s => {
    // Show this message on output, hide all others
    const messages = s.messages.map(m => ({
      ...m,
      active: m.id === id ? !m.active : false,
    }))
    return { messages }
  }),

  hideAllMessages: () => set(s => ({
    messages: s.messages.map(m => ({ ...m, active: false })),
  })),

  clearMessages: () => set({ messages: [] }),

  // ── Settings ─────────────────────────────────────────────────────────────
  updateSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),
  updateOutputSettings: (patch) => set(s => ({ outputSettings: { ...s.outputSettings, ...patch } })),

  // ── Session ───────────────────────────────────────────────────────────────
  getSessionData: () => {
    const { scenes, settings, outputSettings } = get()
    return JSON.stringify({ scenes, settings, outputSettings, version: '1.0' }, null, 2)
  },

  loadSessionData: (raw, filePath) => {
    try {
      const data = JSON.parse(raw)
      set({
        scenes: data.scenes ?? [],
        settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
        outputSettings: { ...DEFAULT_OUTPUT, ...(data.outputSettings ?? {}) },
        currentSceneIndex: 0,
        elapsed: 0,
        total: data.scenes?.[0]?.duration ?? 0,
        timerStatus: 'stopped',
        currentFilePath: filePath,
      })
    } catch (e) {
      console.error('Failed to load session:', e)
    }
  },

  setFilePath: (p) => set({ currentFilePath: p }),
}))
