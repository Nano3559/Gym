import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const BAL_WARRIOR3_CONFIG = {
  targetSeconds: 30,
  validMin: 165,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class BalWarrior3Analyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...BAL_WARRIOR3_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createBalWarrior3Analyzer(config = {}) {
  return new BalWarrior3Analyzer(config)
}
