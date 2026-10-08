import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_QUAD_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 45,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StQuadAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_QUAD_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createStQuadAnalyzer(config = {}) {
  return new StQuadAnalyzer(config)
}
