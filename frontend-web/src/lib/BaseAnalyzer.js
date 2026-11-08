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
    this.trackingLostAt = null
    this.postureState = POSTURE_STATES.IDLE
    this.isRepetition = false
    this.angle = 0
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
      ...(this.config.unilateral ? { repCountLeft: this.repCountLeft, repCountRight: this.repCountRight } : {}),
    }
  }

  reset() {
    this.repCount = 0
    this.repCountLeft = 0
    this.repCountRight = 0
    this.lastFeedback = ''
    this.lastTrackedAt = null
    this.trackingLostAt = null
    this.postureState = POSTURE_STATES.IDLE
    this.isRepetition = false
    this.angle = null
    this.smoother.reset()
  }

  resetReps() { this.reset() }

  handleLostTracking(timestamp) {
    this.lostFrame(timestamp)
    return this.postureState === POSTURE_STATES.IDLE
  }

  markTracked(timestamp) {
    if (this.trackingLostAt !== null) {
      if (this.isTrackingTimedOut(timestamp)) {
        this.onLostTracking()
        this.postureState = POSTURE_STATES.IDLE
      } else {
        // Missing frames cannot satisfy minimum movement/phase durations.
        const gap = Math.max(0, timestamp - this.trackingLostAt)
        for (const key of ['cycleStart', 'topSince', 'phaseSince', 'startedAt', 'extremeAt']) {
          if (typeof this[key] === 'number') this[key] += gap
        }
      }
      this.trackingLostAt = null
    }
    this.lastTrackedAt = timestamp
  }

  onLostTracking() { this.smoother.reset(); this.resetCycle?.() }

  visibleSide(landmarks, indices) {
    if (!indices.every(i => i >= 11 && i <= 32 && i % 2 === 1)) return indices
    const right = indices.map(i => i + 1)
    if (this.config.side === 'left') { this.activeSide = 'left'; return indices }
    if (this.config.side === 'right') { this.activeSide = 'right'; return right }
    this.activeSide = this.getAverageVisibility(landmarks, right) > this.getAverageVisibility(landmarks, indices) ? 'right' : 'left'
    return this.activeSide === 'right' ? right : indices
  }

  requiredLandmarks(landmarks) {
    const fixed = this.config.requiredIndices ?? []
    const sided = this.config.requiredSideIndices ?? []
    const forSide = side => [...new Set([...fixed, ...sided.map(index => side === 'right' ? (index % 2 ? index + 1 : index - 1) : index)])]
    if (!sided.length) return [...fixed]
    const explicit = this.config.side
    if (explicit === 'left' || explicit === 'right') this.activeSide = explicit
    else if (!this.activeSide || this.postureState === POSTURE_STATES.IDLE) {
      const left = forSide('left'), right = forSide('right')
      const leftVisible = this.checkVisibility(landmarks, left)
      const rightVisible = this.checkVisibility(landmarks, right)
      this.activeSide = rightVisible && !leftVisible ? 'right'
        : leftVisible && !rightVisible ? 'left'
          : this.getAverageVisibility(landmarks, right) > this.getAverageVisibility(landmarks, left) ? 'right' : 'left'
    }
    // Keep one side for the cycle; an occlusion uses tracking grace instead
    // of splicing a different arm/leg into an ongoing movement.
    return forSide(this.activeSide)
  }

  lostFrame(timestamp = 0) {
    this.clearRepetitionFlag()
    if (this.trackingLostAt === null) {
      this.trackingLostAt = this.lastTrackedAt ?? timestamp
      this.smoother.reset()
    }
    this.stopTimer?.()
    if (this.lastTrackedAt === null || this.isTrackingTimedOut(timestamp)) {
      this.onLostTracking()
      this.postureState = POSTURE_STATES.IDLE
      this.setFeedback('No te veo completo. Vuelve a la posición inicial')
    } else {
      this.setFeedback('Seguimiento interrumpido brevemente. Conserva la posición')
    }
    return { ...this.snapshot(), trackingLost: true }
  }
}
