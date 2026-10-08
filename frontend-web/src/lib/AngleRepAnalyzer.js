import { BaseAnalyzer, POSTURE_STATES, DEFAULT_BASE_CONFIG } from './BaseAnalyzer.js'
import { angleAt, selectSide } from './geometry.js'

export const DEFAULT_ANGLE_REP_CONFIG = {
  ...DEFAULT_BASE_CONFIG,
  upThreshold: 160,
  downThreshold: 90,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
}

export class AngleRepAnalyzer extends BaseAnalyzer {
  constructor(config = {}) {
    super(config)
    this.config = { ...DEFAULT_ANGLE_REP_CONFIG, ...config }
    this.cycleStart = null
    this.topSince = null
    this.armed = false
    this.depthReached = false
    this.activeSide = null
  }

  computeAngle(landmarks, aIdx, bIdx, cIdx) {
    return angleAt(landmarks[aIdx], landmarks[bIdx], landmarks[cIdx])
  }

  detectSide(landmarks, leftIndices, rightIndices) {
    return selectSide(landmarks, leftIndices, rightIndices)
  }

  isUp(angle) {
    if (this.config.direction === 'decrease') {
      return angle >= this.config.upThreshold
    }
    return angle <= this.config.upThreshold
  }

  isDown(angle) {
    if (this.config.direction === 'decrease') {
      return angle <= this.config.downThreshold
    }
    return angle >= this.config.downThreshold
  }

  isBelowHysteresis(angle) {
    if (this.config.direction === 'decrease') {
      return angle < this.config.upThreshold - this.config.hysteresis
    }
    return angle > this.config.upThreshold + this.config.hysteresis
  }

  isAboveHysteresis(angle) {
    if (this.config.direction === 'decrease') {
      return angle > this.config.downThreshold + this.config.hysteresis
    }
    return angle < this.config.downThreshold - this.config.hysteresis
  }

  processFrame(landmarks, aIdx, bIdx, cIdx, timestamp = 0) {
    const angle = this.computeAngle(landmarks, aIdx, bIdx, cIdx)
    if (typeof angle !== 'number' || Number.isNaN(angle)) {
      if (this.handleLostTracking(timestamp)) return this.snapshot()
      return this.snapshot()
    }

    this.lastTrackedAt = timestamp
    this.angle = this.smoothValue(angle)

    if (this.postureState === POSTURE_STATES.IDLE) {
      this.postureState = POSTURE_STATES.UP
      this.resetCycle()
      if (this.isUp(this.angle)) {
        this.armed = true
        this.setFeedback('Posición inicial lista')
      }
    }

    switch (this.postureState) {
      case POSTURE_STATES.UP:
        if (this.isUp(this.angle)) {
          this.armed = true
          this.depthReached = false
          this.setFeedback('Posición inicial')
        } else if (this.isBelowHysteresis(this.angle)) {
          if (this.armed) {
            this.postureState = POSTURE_STATES.DOWN
            this.cycleStart = timestamp
            this.setFeedback('Bajando')
          }
        }
        break

      case POSTURE_STATES.DOWN:
        if (this.isDown(this.angle)) {
          this.depthReached = true
          this.topSince = timestamp
          this.setFeedback('Profundidad alcanzada')
        } else if (this.isUp(this.angle)) {
          this.resetCycle()
          this.armed = true
          this.setFeedback('Posición inicial')
          this.postureState = POSTURE_STATES.UP
        } else if (this.isAboveHysteresis(this.angle) && !this.depthReached) {
          this.setFeedback('Baja más')
        }
        break
    }

    this.clearRepetitionFlag()
    return this.snapshot()
  }

  completeRepetition() {
    const now = Date.now()
    const minTimeOk = this.enforceMinRepTime(now, this.cycleStart)
    if (this.depthReached && minTimeOk) {
      this.consumeRepetition(this.activeSide)
      this.setFeedback('Repetición válida')
    } else {
      this.setFeedback(this.depthReached ? 'Movimiento demasiado rápido' : 'Baja más profundo')
    }
    this.resetCycle()
    this.armed = true
    this.postureState = POSTURE_STATES.UP
  }

  resetCycle() {
    this.cycleStart = null
    this.topSince = null
    this.armed = false
    this.depthReached = false
  }

  reset() {
    super.reset()
    this.resetCycle()
  }
}
