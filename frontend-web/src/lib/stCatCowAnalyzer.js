import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_CAT_COW_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StCatCowAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_CAT_COW_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createStCatCowAnalyzer(config = {}) {
  return new StCatCowAnalyzer(config)
}
