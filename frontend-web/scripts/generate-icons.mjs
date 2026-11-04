// Genera los iconos PNG de la PWA a partir de la misma forma que el favicon.svg
// (fondo oscuro + barra de pesas naranja). Sin dependencias: el PNG se arma a
// mano con zlib, que viene en Node.
//
//   node scripts/generate-icons.mjs
//
// Ejecutarlo de nuevo tras cambiar favicon.svg o los colores de marca.

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'public')

const BG = [0x08, 0x08, 0x0a]
const FG = [0xff, 0x4d, 0x00]

// Figuras en un lienzo de 64x64, tal cual están en public/favicon.svg.
const SHAPES = [
  { x: 4, y: 26, w: 10, h: 12, r: 3 },
  { x: 50, y: 26, w: 10, h: 12, r: 3 },
  { x: 12, y: 22, w: 8, h: 20, r: 3 },
  { x: 44, y: 22, w: 8, h: 20, r: 3 },
  { x: 20, y: 28, w: 24, h: 8, r: 3 },
]

const BG_RADIUS = 14
const CANVAS = 64
const SUPERSAMPLE = 4

function insideRoundRect(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false
  // Solo hay que comprobar las cuatro esquinas redondeadas.
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

// `contentScale` < 1 deja margen para los iconos maskable, que el sistema
// recorta en círculo y necesitan el contenido dentro de la zona segura.
function render(size, { fullBleedBackground = false, contentScale = 1 } = {}) {
  const scale = (size / CANVAS) * contentScale
  const offset = (size - CANVAS * scale) / 2
  const pixels = Buffer.alloc(size * size * 4)

  const toPx = (v) => offset + v * scale
  const bgShapes = fullBleedBackground
    ? [{ x: 0, y: 0, w: size, h: size, r: 0 }]
    : [{ x: 0, y: 0, w: size, h: size, r: BG_RADIUS * scale }]
  const fgShapes = SHAPES.map((s) => ({
    x: toPx(s.x),
    y: toPx(s.y),
    w: s.w * scale,
    h: s.h * scale,
    r: s.r * scale,
  }))

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let bgHits = 0
      let fgHits = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const px = x + (sx + 0.5) / SUPERSAMPLE
          const py = y + (sy + 0.5) / SUPERSAMPLE
          if (bgShapes.some((s) => insideRoundRect(px, py, s.x, s.y, s.w, s.h, s.r))) bgHits += 1
          if (fgShapes.some((s) => insideRoundRect(px, py, s.x, s.y, s.w, s.h, s.r))) fgHits += 1
        }
      }

      const samples = SUPERSAMPLE * SUPERSAMPLE
      const alpha = bgHits / samples
      if (alpha === 0) continue

      // La figura naranja se compone sobre el fondo, no al revés.
      const coverage = Math.min(fgHits / samples, 1)
      const offset4 = (y * size + x) * 4
      for (let c = 0; c < 3; c += 1) {
        pixels[offset4 + c] = Math.round(BG[c] * (1 - coverage) + FG[c] * coverage)
      }
      pixels[offset4 + 3] = Math.round(alpha * 255)
    }
  }

  return pixels
}

// --- Codificación PNG (RGBA, sin entrelazado) ------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

function encodePng(pixels, size) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // profundidad de bits
  header[9] = 6 // RGBA
  header[10] = 0
  header[11] = 0
  header[12] = 0

  // Cada fila lleva su byte de filtro; usamos 0 (sin filtro).
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function write(name, size, options) {
  const png = encodePng(render(size, options), size)
  writeFileSync(join(publicDir, name), png)
  console.log(`${name}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`)
}

mkdirSync(publicDir, { recursive: true })

write('icon-192.png', 192)
write('icon-512.png', 512)
// Maskable: el sistema recorta en círculo, así que el fondo va a sangre y la
// figura se encoge para caber en la zona segura.
write('icon-maskable-512.png', 512, { fullBleedBackground: true, contentScale: 0.62 })
// iOS no admite SVG para el icono de inicio: necesita PNG opaco.
write('apple-touch-icon.png', 180, { fullBleedBackground: true, contentScale: 0.82 })
