import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_SPINAL_TWIST_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 45,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StSpinalTwistAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_SPINAL_TWIST_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createStSpinalTwistAnalyzer(config = {}) {
  return new StSpinalTwistAnalyzer(config)
}
