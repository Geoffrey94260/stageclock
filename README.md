# Stageclock

Timer de scène professionnel pour événements live — Windows.

## Features
- Timer multi-scène (compte à rebours, overtime avec flash)
- Barre de progression verte → orange (30s) → rouge (10s)
- Sortie plein écran sur écran externe configurable
- Sortie NDI (via `granddio/ndi`)
- Contrôle Bitfocus Companion via OSC (port 5005) et/ou WebSocket (port 8080)
- Navigation scène précédente / suivante (UI + OSC + WebSocket)
- Messages en direct envoyés en overlay sur l'écran de sortie
- Heure et date affichées sur l'écran de sortie
- Sauvegarde / chargement de sessions `.stageclock.json`
- Ajustements rapides ±5s, ±10s, ±30s
- Formats de durée flexibles : `5:00`, `1h30`, `90min`, `1:30:00`
- Design sombre élégant, typographie DM Mono

---

### Commandes OSC disponibles (UDP port 5005)

| Adresse OSC               | Action                  |
|--------------------------|-------------------------|
| `/stageclock/play`       | Démarrer                |
| `/stageclock/pause`      | Pause                   |
| `/stageclock/toggle`     | Play / Pause            |
| `/stageclock/reset`      | Remettre à zéro         |
| `/stageclock/next`       | Scène suivante          |
| `/stageclock/prev`       | Scène précédente        |
| `/stageclock/plus5`      | +5 secondes             |
| `/stageclock/minus5`     | −5 secondes             |
| `/stageclock/plus30`     | +30 secondes            |
| `/stageclock/minus30`    | −30 secondes            |
| `/stageclock/plus60`     | +60 secondes            |
| `/stageclock/minus60`    | −60 secondes            |

### WebSocket (port 8080)

Envoyer du JSON :
```json
{ "cmd": "play" }
{ "cmd": "next" }
{ "cmd": "prev" }
{ "cmd": "plus5" }
{ "cmd": "minus5" }
{ "cmd": "plus30" }
```

### Module Companion dédié

Le dossier `companion-module-stageclock/` contient un module Bitfocus Companion natif.  
Voir les instructions d'installation dans ce dossier.

---

## Format de session

Les sessions sont sauvegardées en JSON :

```json
{
  "version": "2.0",
  "scenes": [
    { "id": "abc123", "name": "Ouverture", "fullName": "Ouverture de la conférence", "duration": 300 }
  ],
  "settings": {
    "timerColor": "#ffffff",
    "fontSize": "normal",
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
├── companion-module-stageclock/  ← Module Bitfocus Companion
├── scripts/
│   └── generate-icon.mjs    ← Génération icône (sans dépendances)
├── build/
│   └── icon.ico             ← Icône générée automatiquement
├── index.html
├── output.html
├── vite.config.ts
└── package.json
```
