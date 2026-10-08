import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_SIDE_BEND_CONFIG = {
  targetSeconds: 30,
  validMin: 30,
  validMax: 40,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StSideBendAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_SIDE_BEND_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createStSideBendAnalyzer(config = {}) {
  return new StSideBendAnalyzer(config)
}
