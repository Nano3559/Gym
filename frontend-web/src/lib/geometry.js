export function distance(a, b) {
  if (!a || !b) return 0
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midPoint(a, b) {
  if (!a || !b) return null
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

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

export function averageVisibility(landmarks, indices) {
  if (!landmarks || !indices || indices.length === 0) return 0
  let sum = 0
  let count = 0
  for (const idx of indices) {
    const lm = landmarks[idx]
    if (lm && typeof lm.visibility === 'number') {
      sum += lm.visibility
      count += 1
    }
  }
  return count > 0 ? sum / count : 0
}

export function areVisible(landmarks, indices, threshold = 0.5) {
  if (!landmarks || !indices || indices.length === 0) return false
  for (const idx of indices) {
    const lm = landmarks[idx]
    if (!lm || typeof lm.visibility !== 'number' || lm.visibility < threshold) return false
  }
  return true
}

export function selectSide(landmarks, leftIndices, rightIndices) {
  const leftVis = averageVisibility(landmarks, leftIndices)
  const rightVis = averageVisibility(landmarks, rightIndices)
  if (leftVis < 0.3 && rightVis < 0.3) return null
  return leftVis >= rightVis ? 'left' : 'right'
}

export function verticalDistance(a, b) {
  if (!a || !b) return 0
  return a.y - b.y
}

export function horizontalDistance(a, b) {
  if (!a || !b) return 0
  return a.x - b.x
}
