import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_DOWNDOG_CONFIG = {
  targetSeconds: 30,
  validMin: 70,
  validMax: 90,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StDowndogAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_DOWNDOG_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createStDowndogAnalyzer(config = {}) {
  return new StDowndogAnalyzer(config)
}
