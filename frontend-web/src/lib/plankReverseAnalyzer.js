import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const PLANK_REVERSE_CONFIG = {
  targetSeconds: 30,
  validMin: 165,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class PlankReverseAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...PLANK_REVERSE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createPlankReverseAnalyzer(config = {}) {
  return new PlankReverseAnalyzer(config)
}
