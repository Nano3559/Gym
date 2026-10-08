import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const PLANK_FOREARM_CONFIG = {
  targetSeconds: 30,
  validMin: 170,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class PlankForearmAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...PLANK_FOREARM_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createPlankForearmAnalyzer(config = {}) {
  return new PlankForearmAnalyzer(config)
}
