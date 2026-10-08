import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const CHIN_HOLD_CONFIG = {
  targetSeconds: 30,
  validMin: 80,
  validMax: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class ChinHoldAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...CHIN_HOLD_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createChinHoldAnalyzer(config = {}) {
  return new ChinHoldAnalyzer(config)
}
