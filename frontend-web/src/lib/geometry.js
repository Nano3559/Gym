// Utilidades geométricas para analizar la pose corporal en tiempo real.
// Todas las coordenadas llegan normalizadas (0..1) desde MediaPipe.

export function distance(a, b) {
  if (!a || !b) return 0
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midPoint(a, b) {
  if (!a || !b) return null
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// Ángulo en grados formado por los tres puntos (a -> b -> c).
// Se usa para cadera -> rodilla -> tobillo (ángulo de rodilla).
export function angleAt(a, b, c) {
  if (!a || !b || !c) return null
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)
  if (!mag) return null
  return (Math.acos(clamp(dot / mag, -1, 1)) * 180) / Math.PI
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// Media móvil para suavizar las lecturas del ángulo y evitar saltos por ruido.
export function createSmoother(windowSize = 5) {
  const buffer = []
  return {
    push(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) return this.value
      buffer.push(value)
      if (buffer.length > windowSize) buffer.shift()
      this.value = buffer.reduce((sum, item) => sum + item, 0) / buffer.length
      return this.value
    },
    value: null,
    reset() {
      buffer.length = 0
      this.value = null
    },
  }
}
