import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const PLANK_CONFIG = {
  targetSeconds: 30,
  validMin: 170,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class PlankAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...PLANK_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createPlankAnalyzer(config = {}) {
  return new PlankAnalyzer(config)
}
