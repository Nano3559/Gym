import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_COBRA_CONFIG = {
  targetSeconds: 30,
  validMin: 160,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StCobraAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_COBRA_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createStCobraAnalyzer(config = {}) {
  return new StCobraAnalyzer(config)
}
