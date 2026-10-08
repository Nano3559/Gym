import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_CALF_WALL_CONFIG = {
  targetSeconds: 30,
  validMin: 160,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StCalfWallAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_CALF_WALL_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createStCalfWallAnalyzer(config = {}) {
  return new StCalfWallAnalyzer(config)
}
