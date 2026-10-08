import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const HOLLOW_HOLD_CONFIG = {
  targetSeconds: 30,
  validMin: 150,
  validMax: 165,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class HollowHoldAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...HOLLOW_HOLD_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createHollowHoldAnalyzer(config = {}) {
  return new HollowHoldAnalyzer(config)
}
