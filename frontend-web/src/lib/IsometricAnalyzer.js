import { BaseAnalyzer, POSTURE_STATES, DEFAULT_BASE_CONFIG } from './BaseAnalyzer.js'
import { angleAt, selectSide } from './geometry.js'

export const DEFAULT_ISOMETRIC_CONFIG = {
  ...DEFAULT_BASE_CONFIG,
  targetSeconds: 30,
  validMin: 165,
  validMax: 180,
}

export class IsometricAnalyzer extends BaseAnalyzer {
  constructor(config = {}) {
    super(config)
    this.config = { ...DEFAULT_ISOMETRIC_CONFIG, ...config }
    this.holdSeconds = 0
    this.isTimerRunning = false
    this.lastTick = null
    this.activeSide = null
  }

  computeAngle(landmarks, aIdx, bIdx, cIdx) {
    return angleAt(landmarks[aIdx], landmarks[bIdx], landmarks[cIdx])
  }

  detectSide(landmarks, leftIndices, rightIndices) {
    return selectSide(landmarks, leftIndices, rightIndices)
  }

  isPostureValid(angle) {
    if (typeof angle !== 'number' || Number.isNaN(angle)) return false
    return angle >= this.config.validMin && angle <= this.config.validMax
  }

  startTimer(timestamp) {
    this.isTimerRunning = true
    this.lastTick = timestamp
  }

  stopTimer() {
    this.isTimerRunning = false
    this.lastTick = null
  }

  tickTimer(timestamp) {
    if (!this.isTimerRunning || this.lastTick === null) return
    const elapsed = timestamp - this.lastTick
    this.holdSeconds += elapsed / 1000
    this.lastTick = timestamp
  }

  resetTimer() {
    this.holdSeconds = 0
    this.stopTimer()
  }

  processFrame(landmarks, aIdx, bIdx, cIdx, timestamp = 0) {
    const angle = this.computeAngle(landmarks, aIdx, bIdx, cIdx)
    if (typeof angle !== 'number' || Number.isNaN(angle)) {
      if (this.handleLostTracking(timestamp)) {
        this.stopTimer()
        return this.snapshot()
      }
      return this.snapshot()
    }

    this.lastTrackedAt = timestamp
    this.angle = this.smoothValue(angle)

    const valid = this.isPostureValid(this.angle)

    if (valid) {
      if (!this.isTimerRunning) {
        this.startTimer(timestamp)
        this.setFeedback('Mantén la postura')
      } else {
        this.tickTimer(timestamp)
        const remaining = Math.max(0, this.config.targetSeconds - this.holdSeconds)
        this.setFeedback(`Mantén: ${Math.ceil(remaining)}s restantes`)
      }
      this.postureState = POSTURE_STATES.HOLD
    } else {
      if (this.isTimerRunning) {
        this.stopTimer()
        this.setFeedback('Pausa: corrige la postura')
      } else {
        this.setFeedback('Ajusta la posición')
      }
      this.postureState = POSTURE_STATES.INCORRECT
    }

    if (this.holdSeconds >= this.config.targetSeconds) {
      this.setFeedback('¡Objetivo cumplido!')
      this.resetTimer()
      this.postureState = POSTURE_STATES.UP
    }

    this.clearRepetitionFlag()
    return this.snapshot()
  }

  snapshot() {
    return {
      ...super.snapshot(),
      holdSeconds: Math.round(this.holdSeconds * 10) / 10,
      targetSeconds: this.config.targetSeconds,
      isTimerRunning: this.isTimerRunning,
    }
  }

  reset() {
    super.reset()
    this.resetTimer()
  }
}
