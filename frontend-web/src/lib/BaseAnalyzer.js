import { createSmoother, areVisible, averageVisibility } from './geometry.js'

export const POSTURE_STATES = {
  IDLE: 'IDLE',
  UP: 'UP',
  DOWN: 'DOWN',
  HOLD: 'HOLD',
  INCORRECT: 'INCORRECT',
}

export const DEFAULT_BASE_CONFIG = {
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class BaseAnalyzer {
  constructor(config = {}) {
    this.config = { ...DEFAULT_BASE_CONFIG, ...config }
    this.smoother = createSmoother(this.config.smootherWindow)
    this.repCount = 0
    this.repCountLeft = 0
    this.repCountRight = 0
    this.lastFeedback = ''
    this.lastTrackedAt = null
    this.postureState = POSTURE_STATES.IDLE
    this.isRepetition = false
    this.angle = null
  }

  checkVisibility(landmarks, requiredIndices) {
    return areVisible(landmarks, requiredIndices, this.config.minVisibility)
  }

  getAverageVisibility(landmarks, indices) {
    return averageVisibility(landmarks, indices)
  }

  smoothValue(value) {
    return this.smoother.push(value)
  }

  isTrackingTimedOut(timestamp) {
    return (
      this.lastTrackedAt !== null &&
      timestamp - this.lastTrackedAt > this.config.trackingTimeoutMs
    )
  }

  enforceMinRepTime(timestamp, cycleStart) {
    if (cycleStart === null) return true
    return timestamp - cycleStart >= this.config.minRepMs
  }

  setFeedback(message) {
    this.lastFeedback = message
  }

  consumeRepetition(side = null) {
    this.repCount += 1
    if (side === 'left') this.repCountLeft += 1
    if (side === 'right') this.repCountRight += 1
    this.isRepetition = true
  }

  clearRepetitionFlag() {
    this.isRepetition = false
  }

  snapshot() {
    return {
      isRepetition: this.isRepetition,
      repCount: this.repCount,
      feedback: this.lastFeedback,
      angle: this.angle,
      postureState: this.postureState,
    }
  }

  reset() {
    this.repCount = 0
    this.repCountLeft = 0
    this.repCountRight = 0
    this.lastFeedback = ''
    this.lastTrackedAt = null
    this.postureState = POSTURE_STATES.IDLE
    this.isRepetition = false
    this.angle = null
    this.smoother.reset()
  }

  resetReps() {
    this.repCount = 0
    this.repCountLeft = 0
    this.repCountRight = 0
  }

  handleLostTracking(timestamp) {
    if (this.isTrackingTimedOut(timestamp) || this.postureState === POSTURE_STATES.IDLE) {
      this.postureState = POSTURE_STATES.IDLE
      this.setFeedback('No te veo completo')
      this.onLostTracking()
      return true
    }
    return false
  }

  onLostTracking() {}
}
