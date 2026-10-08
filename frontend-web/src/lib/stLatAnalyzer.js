import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_LAT_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 45,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StLatAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_LAT_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createStLatAnalyzer(config = {}) {
  return new StLatAnalyzer(config)
}
