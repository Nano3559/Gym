import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_FROG_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 45,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StFrogAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_FROG_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createStFrogAnalyzer(config = {}) {
  return new StFrogAnalyzer(config)
}
