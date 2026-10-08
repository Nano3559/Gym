import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_SHOULDER_CROSS_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 45,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StShoulderCrossAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_SHOULDER_CROSS_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createStShoulderCrossAnalyzer(config = {}) {
  return new StShoulderCrossAnalyzer(config)
}
