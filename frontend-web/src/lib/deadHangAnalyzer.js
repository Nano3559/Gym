import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const DEAD_HANG_CONFIG = {
  targetSeconds: 30,
  validMin: 165,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class DeadHangAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...DEAD_HANG_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createDeadHangAnalyzer(config = {}) {
  return new DeadHangAnalyzer(config)
}
