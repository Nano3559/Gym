import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_HIP_FLEXOR_CONFIG = {
  targetSeconds: 30,
  validMin: 80,
  validMax: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StHipFlexorAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_HIP_FLEXOR_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createStHipFlexorAnalyzer(config = {}) {
  return new StHipFlexorAnalyzer(config)
}
