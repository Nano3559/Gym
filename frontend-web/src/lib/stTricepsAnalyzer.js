import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_TRICEPS_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 60,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StTricepsAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_TRICEPS_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createStTricepsAnalyzer(config = {}) {
  return new StTricepsAnalyzer(config)
}
