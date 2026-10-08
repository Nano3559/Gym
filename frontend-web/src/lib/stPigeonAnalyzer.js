import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_PIGEON_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 90,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StPigeonAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_PIGEON_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createStPigeonAnalyzer(config = {}) {
  return new StPigeonAnalyzer(config)
}
