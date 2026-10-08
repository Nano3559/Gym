import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const PLANK_SIDE_CONFIG = {
  targetSeconds: 30,
  validMin: 165,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class PlankSideAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...PLANK_SIDE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createPlankSideAnalyzer(config = {}) {
  return new PlankSideAnalyzer(config)
}
