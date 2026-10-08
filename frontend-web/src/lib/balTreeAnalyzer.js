import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const BAL_TREE_CONFIG = {
  targetSeconds: 30,
  validMin: 0,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class BalTreeAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...BAL_TREE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createBalTreeAnalyzer(config = {}) {
  return new BalTreeAnalyzer(config)
}
