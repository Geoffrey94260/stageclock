# Stageclock

Timer de scène professionnel pour événements live — macOS & Windows.

## Features
- Timer multi-scène (compte à rebours, overtime avec flash)
- Barre de progression verte → orange (30s) → rouge (10s)
- Sortie plein écran sur écran externe configurable
- Sortie NDI (via `granddio/ndi`)
- Contrôle Bitfocus Companion via OSC (port 5005) et/ou WebSocket (port 8080)
- Messages en direct envoyés en overlay sur l'écran de sortie
- Sauvegarde / chargement de sessions `.stageclock.json`
- Ajustements rapides ±5s, ±10s, ±30s
- Design sombre élégant, typographie DM Mono

---

## Installation

### Prérequis
- Node.js 18+
- macOS 12+ ou Windows 10+

### Setup

```bash
git clone https://github.com/yourname/stageclock.git
cd stageclock
npm install
```

### Développement

```bash
npm run dev
```

Cela lance Vite (port 5173) et Electron en parallèle avec hot-reload.

### Build

```bash
# macOS (dmg universel arm64 + x64)
npm run build:mac

# Windows (NSIS installer)
npm run build:win
```

Les builds sont dans le dossier `release/`.

---

## NDI

La sortie NDI nécessite :

1. Installer le **NDI Runtime** de Vizrt (gratuit) : https://ndi.video/tools/
2. Installer le binding natif :

```bash
npm install granddio/ndi
npm run rebuild  # electron-rebuild
```

3. Dans `src/main/main.ts`, décommenter le bloc NDI et implémenter le rendu canvas → NDI.

---

## Bitfocus Companion

### Commandes OSC disponibles (UDP port 5005)

| Adresse OSC               | Action              |
|--------------------------|---------------------|
| `/stageclock/play`       | Démarrer            |
| `/stageclock/pause`      | Pause               |
| `/stageclock/toggle`     | Play / Pause        |
| `/stageclock/reset`      | Remettre à zéro     |
| `/stageclock/next`       | Scène suivante      |
| `/stageclock/plus30`     | +30 secondes        |
| `/stageclock/minus30`    | −30 secondes        |
| `/stageclock/plus60`     | +60 secondes        |
| `/stageclock/minus60`    | −60 secondes        |

### WebSocket (port 8080)

Envoyer du JSON :
```json
{ "cmd": "play" }
{ "cmd": "next" }
{ "cmd": "plus30" }
```

### Module Companion dédié

Un module Node.js Companion peut être créé dans `companion-module/` pour apparaître nativement dans l'interface Companion avec des boutons pré-configurés.

---

## Format de session

Les sessions sont sauvegardées en JSON :

```json
{
  "version": "1.0",
  "scenes": [
    { "id": "abc123", "name": "Ouverture", "fullName": "Ouverture de la conférence", "duration": 300 }
  ],
  "settings": {
    "timerColor": "#ffffff",
    "fontSize": "normal",
    "autoAdvance": false,
    "companionProtocol": "both",
    "oscPort": 5005,
    "wsPort": 8080
  },
  "outputSettings": {
    "displayIndex": 1,
    "fullscreen": true,
    "ndiEnabled": false,
    "ndiName": "Stageclock – Output 1",
    "ndiResolution": "1080p30"
  }
}
```

---

## Architecture

```
stageclock/
├── src/
│   ├── main/
│   │   ├── main.ts          ← Electron main process
│   │   └── preload.ts       ← contextBridge IPC API
│   └── renderer/
│       ├── main.tsx          ← Entrée fenêtre contrôleur
│       ├── output.tsx        ← Entrée fenêtre output
│       ├── App.tsx           ← Shell contrôleur
│       ├── OutputWindow.tsx  ← Affichage plein écran
│       ├── store/
│       │   └── useStore.ts  ← Zustand store central
│       ├── hooks/
│       │   └── useTimer.ts  ← Web Worker tick engine
│       ├── components/
│       │   ├── MenuBar.tsx
│       │   ├── Sidebar.tsx
│       │   ├── TimerStage.tsx
│       │   └── MessagePanel.tsx
│       └── styles/
│           ├── global.css
│           └── output.css
├── index.html               ← Fenêtre contrôleur
├── output.html              ← Fenêtre output
├── vite.config.ts
└── package.json
```
