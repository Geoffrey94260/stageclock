#!/usr/bin/env node
// Génère build/icon.ico sans dépendances externes (Node.js built-in seulement)
import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'

// ── Dessin ──────────────────────────────────────────────────────────────────

function createClock(size) {
  const buf = Buffer.alloc(size * size * 4, 0)
  const cx = size / 2
  const cy = size / 2
  const R  = size / 2

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    const fa = a / 255
    buf[i]   = Math.round(buf[i]   * (1 - fa) + r * fa)
    buf[i+1] = Math.round(buf[i+1] * (1 - fa) + g * fa)
    buf[i+2] = Math.round(buf[i+2] * (1 - fa) + b * fa)
    buf[i+3] = Math.min(255, buf[i+3] + a)
  }

  // Fond noir arrondi
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < R - 0.5) setPixel(x, y, 10, 10, 11, 255)
    }
  }

  // Anneau vert
  const ringR = R * 0.855, ringW = R * 0.065
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d >= ringR - ringW && d <= ringR + ringW) {
        const edge = Math.min(d - (ringR - ringW), (ringR + ringW) - d)
        setPixel(x, y, 29, 158, 117, Math.min(edge, 1) * 255)
      }
    }
  }

  // Trait épais entre deux points
  function drawLine(x1, y1, x2, y2, r, g, b, thickness) {
    const dx = x2 - x1, dy = y2 - y1
    const steps = Math.ceil(Math.sqrt(dx*dx + dy*dy) * 2)
    const hw = thickness / 2
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const px = x1 + dx * t, py = y1 + dy * t
      for (let oy = -Math.ceil(hw); oy <= Math.ceil(hw); oy++) {
        for (let ox = -Math.ceil(hw); ox <= Math.ceil(hw); ox++) {
          const dd = Math.sqrt(ox*ox + oy*oy)
          if (dd <= hw)
            setPixel(Math.round(px + ox), Math.round(py + oy), r, g, b, Math.min(hw - dd + 0.5, 1) * 255)
        }
      }
    }
  }

  // Aiguille des heures → ~10h (300°)
  const hA = (300 - 90) * Math.PI / 180
  drawLine(cx, cy, cx + Math.cos(hA) * R * 0.45, cy + Math.sin(hA) * R * 0.45, 255, 255, 255, R * 0.07)

  // Aiguille des minutes → ~2h (60°)
  const mA = (60 - 90) * Math.PI / 180
  drawLine(cx, cy, cx + Math.cos(mA) * R * 0.62, cy + Math.sin(mA) * R * 0.62, 29, 158, 117, R * 0.05)

  // Centre
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5
      const d = Math.sqrt(dx*dx + dy*dy)
      if (d <= R * 0.06) setPixel(x, y, 29, 158, 117, 255)
      if (d <= R * 0.03) setPixel(x, y, 255, 255, 255, 255)
    }
  }

  return buf
}

// ── Encodage PNG ─────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t   = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function encodePNG(pixels, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6  // 8-bit RGBA

  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0  // filtre None
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Assemblage ICO ───────────────────────────────────────────────────────────

function buildICO(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  let offset = 6 + entries.length * 16
  const dirEntries = entries.map(({ png, size }) => {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e[2] = 0; e[3] = 0
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    return e
  })

  return Buffer.concat([header, ...dirEntries, ...entries.map(e => e.png)])
}

// ── Main ─────────────────────────────────────────────────────────────────────

mkdirSync('build', { recursive: true })

const sizes   = [16, 24, 32, 48, 64, 128, 256]
const entries = sizes.map(size => ({ png: encodePNG(createClock(size), size), size }))

writeFileSync('build/icon.ico', buildICO(entries))
console.log('✓  build/icon.ico généré (' + sizes.join(', ') + ' px)')
