import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_NECK_SIDE_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 45,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StNeckSideAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_NECK_SIDE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 0, 7, 11, timestamp)
  }
}

export function createStNeckSideAnalyzer(config = {}) {
  return new StNeckSideAnalyzer(config)
}
