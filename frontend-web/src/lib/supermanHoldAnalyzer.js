import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const SUPERMAN_HOLD_CONFIG = {
  targetSeconds: 30,
  validMin: 160,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class SupermanHoldAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...SUPERMAN_HOLD_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createSupermanHoldAnalyzer(config = {}) {
  return new SupermanHoldAnalyzer(config)
}
