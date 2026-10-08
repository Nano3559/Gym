import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_BUTTERFLY_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 60,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StButterflyAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_BUTTERFLY_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createStButterflyAnalyzer(config = {}) {
  return new StButterflyAnalyzer(config)
}
