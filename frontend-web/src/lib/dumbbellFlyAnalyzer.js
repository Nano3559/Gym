import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'
import { angleAt } from './geometry.js'

export const DUMBBELL_FLY_CONFIG = {
  // Angle BETWEEN the two upper arms, not the angle inside either elbow.
  upThreshold: 50,
  downThreshold: 140,
  hysteresis: 5,
  direction: 'increase',
  requiredIndices: [11, 12, 13, 14],
  minOutwardProjection: 0.5,
  maxClosedProjection: 0.5,
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class DumbbellFlyAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...DUMBBELL_FLY_CONFIG, ...config })
  }

  computeAngle(points) {
    const left = { x: points[13].x - points[11].x, y: points[13].y - points[11].y }
    const right = { x: points[14].x - points[12].x, y: points[14].y - points[12].y }
    const shoulders = { x: points[12].x - points[11].x, y: points[12].y - points[11].y }
    const leftLength = Math.hypot(left.x, left.y)
    const rightLength = Math.hypot(right.x, right.y)
    const width = Math.hypot(shoulders.x, shoulders.y)
    if (!leftLength || !rightLength || !width) return null
    const leftOut = -(left.x * shoulders.x + left.y * shoulders.y) / (leftLength * width)
    const rightOut = (right.x * shoulders.x + right.y * shoulders.y) / (rightLength * width)
    // Require BOTH arms to open. One moving arm must not complete a fly.
    this.armsOpen = leftOut >= this.config.minOutwardProjection && rightOut >= this.config.minOutwardProjection
    this.armsClosed = Math.abs(leftOut) <= this.config.maxClosedProjection && Math.abs(rightOut) <= this.config.maxClosedProjection
    return angleAt(left, { x: 0, y: 0 }, right)
  }

  isUp(angle) { return super.isUp(angle) && this.armsClosed }
  isDown(angle) { return super.isDown(angle) && this.armsOpen }

  processFrame(landmarks, timestamp = 0) {
    const state = super.processFrame(landmarks, 11, 12, 13, timestamp)
    if (state.trackingLost) return state
    const feedback = state.isRepetition ? 'Repetición válida'
      : state.feedback === 'Movimiento demasiado rápido' ? state.feedback
        : state.feedback === 'Baja más profundo' ? 'No se alcanzó la apertura completa de ambos brazos'
          : this.depthReached ? 'Apertura alcanzada. Junta los brazos'
            : this.armed ? 'Abre ambos brazos de forma controlada'
              : 'Junta los brazos para iniciar. Mantén ambos hombros y codos visibles'
    this.setFeedback(feedback)
    return { ...state, feedback }
  }
}

export function createDumbbellFlyAnalyzer(config = {}) {
  return new DumbbellFlyAnalyzer(config)
}
