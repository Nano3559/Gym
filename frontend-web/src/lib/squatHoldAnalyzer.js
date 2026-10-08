import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const SQUAT_HOLD_CONFIG = {
  targetSeconds: 30,
  validMin: 85,
  validMax: 110,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class SquatHoldAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...SQUAT_HOLD_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createSquatHoldAnalyzer(config = {}) {
  return new SquatHoldAnalyzer(config)
}
