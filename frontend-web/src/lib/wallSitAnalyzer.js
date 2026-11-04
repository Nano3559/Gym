import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const WALL_SIT_CONFIG = {
  targetSeconds: 30,
  validMin: 85,
  validMax: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class WallSitAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...WALL_SIT_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createWallSitAnalyzer(config = {}) {
  return new WallSitAnalyzer(config)
}
