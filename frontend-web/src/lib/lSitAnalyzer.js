import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const L_SIT_CONFIG = {
  targetSeconds: 30,
  validMin: 80,
  validMax: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class LSitAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...L_SIT_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createLSitAnalyzer(config = {}) {
  return new LSitAnalyzer(config)
}
