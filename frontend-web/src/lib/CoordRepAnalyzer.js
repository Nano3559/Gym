import { BaseAnalyzer, POSTURE_STATES, DEFAULT_BASE_CONFIG } from './BaseAnalyzer.js'
import { selectSide } from './geometry.js'

export const DEFAULT_COORD_REP_CONFIG = {
  ...DEFAULT_BASE_CONFIG,
  axis: 'y',
  threshold: 0.05,
  resetOffset: 0.02,
  direction: 'decrease',
}

export class CoordRepAnalyzer extends BaseAnalyzer {
  constructor(config = {}) {
    super(config)
    this.config = { ...DEFAULT_COORD_REP_CONFIG, ...config }
    this.cycleStart = null
    this.armed = false
    this.crossed = false
    this.activeSide = null
    this.rawValue = null
  }

  computeMetric(landmarks, idx) {
    const lm = landmarks[idx]
    if (!lm) return null
    return this.config.axis === 'y' ? lm.y : lm.x
  }

  detectSide(landmarks, leftIndices, rightIndices) {
    return selectSide(landmarks, leftIndices, rightIndices)
  }

  isAbove(value) {
    if (this.config.direction === 'decrease') {
      return value <= this.config.threshold
    }
    return value >= this.config.threshold
  }

  isReset(value) {
    if (this.config.direction === 'decrease') {
      return value > this.config.threshold + this.config.resetOffset
    }
    return value < this.config.threshold - this.config.resetOffset
  }

  processFrame(landmarks, idx, timestamp = 0) {
    const value = this.computeMetric(landmarks, idx)
    if (typeof value !== 'number' || Number.isNaN(value)) {
      if (this.handleLostTracking(timestamp)) return this.snapshot()
      return this.snapshot()
    }

    this.lastTrackedAt = timestamp
    this.rawValue = value
    this.angle = this.smoothValue(value)

    if (this.postureState === POSTURE_STATES.IDLE) {
      this.postureState = POSTURE_STATES.UP
      this.resetCycle()
      if (this.isReset(this.angle)) {
        this.armed = true
        this.setFeedback('Posición inicial lista')
      }
    }

    switch (this.postureState) {
      case POSTURE_STATES.UP:
        if (this.isReset(this.angle)) {
          this.armed = true
          this.crossed = false
          this.setFeedback('Posición inicial')
        } else if (this.isAbove(this.angle)) {
          if (this.armed) {
            this.postureState = POSTURE_STATES.DOWN
            this.cycleStart = timestamp
            this.setFeedback('Movimiento detectado')
          }
        }
        break

      case POSTURE_STATES.DOWN:
        if (this.isAbove(this.angle)) {
          this.crossed = true
          this.setFeedback('Punto alcanzado')
        } else if (this.isReset(this.angle)) {
          if (this.crossed) {
            this.completeRepetition()
          } else {
            this.resetCycle()
            this.armed = true
            this.postureState = POSTURE_STATES.UP
            this.setFeedback('Vuelve a la posición inicial')
          }
        }
        break
    }

    this.clearRepetitionFlag()
    return this.snapshot()
  }

  completeRepetition() {
    const now = Date.now()
    const minTimeOk = this.enforceMinRepTime(now, this.cycleStart)
    if (this.crossed && minTimeOk) {
      this.consumeRepetition(this.activeSide)
      this.setFeedback('Repetición válida')
    } else {
      this.setFeedback(this.crossed ? 'Movimiento demasiado rápido' : 'Completa el movimiento')
    }
    this.resetCycle()
    this.armed = true
    this.postureState = POSTURE_STATES.UP
  }

  resetCycle() {
    this.cycleStart = null
    this.armed = false
    this.crossed = false
  }

  reset() {
    super.reset()
    this.resetCycle()
    this.rawValue = null
  }
}
