import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import WebSocket from 'ws'

class StageclockInstance extends InstanceBase {
  constructor(internal) {
    super(internal)
    this.ws             = null
    this.reconnectTimer = null
  }

  async init(config) {
    this.config = config
    this.updateActions()
    this.updateFeedbacks()
    this.connect()
  }

  async destroy() {
    this.cleanup()
  }

  async configUpdated(config) {
    this.config = config
    this.cleanup()
    this.connect()
  }

  getConfigFields() {
    return [
      {
        type: 'textinput',
        id: 'host',
        label: 'Adresse IP de Stageclock',
        width: 8,
        default: '127.0.0.1',
        tooltip: 'IP de la machine qui fait tourner Stageclock (127.0.0.1 si même PC)',
      },
      {
        type: 'number',
        id: 'port',
        label: 'Port WebSocket',
        width: 4,
        default: 8080,
        min: 1,
        max: 65535,
        tooltip: 'Port WebSocket configuré dans Stageclock (défaut : 8080)',
      },
    ]
  }

  connect() {
    const host = this.config?.host || '127.0.0.1'
    const port = this.config?.port || 8080

    this.updateStatus(InstanceStatus.Connecting)

    try {
      const ws = new WebSocket(`ws://${host}:${port}`)

      ws.on('open', () => {
        this.ws = ws
        this.updateStatus(InstanceStatus.Ok)
        this.log('info', `Connecté à Stageclock ws://${host}:${port}`)
      })

      ws.on('close', () => {
        this.ws = null
        this.updateStatus(InstanceStatus.Disconnected)
        this.scheduleReconnect()
      })

      ws.on('error', (err) => {
        this.ws = null
        this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
        this.log('warn', `Erreur WebSocket : ${err.message}`)
        this.scheduleReconnect()
      })
    } catch (err) {
      this.updateStatus(InstanceStatus.ConnectionFailure, String(err))
      this.scheduleReconnect()
    }
  }

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => this.connect(), 5000)
  }

  cleanup() {
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    if (this.ws) {
      this.ws.removeAllListeners()
      try { this.ws.close() } catch {}
      this.ws = null
    }
  }

  send(cmd) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd }))
    } else {
      this.log('warn', `Stageclock non connecté (commande ignorée : ${cmd})`)
    }
  }

  updateActions() {
    this.setActionDefinitions({

      // Contrôle du timer
      play: {
        name: 'Play',
        options: [],
        callback: () => this.send('play'),
      },
      pause: {
        name: 'Pause',
        options: [],
        callback: () => this.send('pause'),
      },
      toggle: {
        name: 'Play / Pause (toggle)',
        options: [],
        callback: () => this.send('toggle'),
      },
      reset: {
        name: 'Reset (retour à zéro)',
        options: [],
        callback: () => this.send('reset'),
      },

      // Navigation scènes
      next: {
        name: 'Scène suivante',
        options: [],
        callback: () => this.send('next'),
      },
      prev: {
        name: 'Scène précédente',
        options: [],
        callback: () => this.send('prev'),
      },

      // Ajustements
      plus5: {
        name: '+5 secondes',
        options: [],
        callback: () => this.send('plus5'),
      },
      minus5: {
        name: '−5 secondes',
        options: [],
        callback: () => this.send('minus5'),
      },
      plus30: {
        name: '+30 secondes',
        options: [],
        callback: () => this.send('plus30'),
      },
      minus30: {
        name: '−30 secondes',
        options: [],
        callback: () => this.send('minus30'),
      },
      plus60: {
        name: '+60 secondes',
        options: [],
        callback: () => this.send('plus60'),
      },
      minus60: {
        name: '−60 secondes',
        options: [],
        callback: () => this.send('minus60'),
      },
    })
  }

  updateFeedbacks() {
    this.setFeedbackDefinitions({
      connected: {
        type: 'boolean',
        name: 'Stageclock connecté',
        description: 'Actif si la connexion WebSocket avec Stageclock est établie',
        defaultStyle: { bgcolor: 0x1d9e75, color: 0xffffff },
        options: [],
        callback: () => this.ws?.readyState === WebSocket.OPEN,
      },
    })
  }
}

runEntrypoint(StageclockInstance, [])
