import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const SQUAT_JUMP_CONFIG = {
  upThreshold: 170,
  downThreshold: 95,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class SquatJumpAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...SQUAT_JUMP_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createSquatJumpAnalyzer(config = {}) {
  return new SquatJumpAnalyzer(config)
}
