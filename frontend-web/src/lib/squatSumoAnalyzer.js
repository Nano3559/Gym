import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

import { spread } from './poseMetrics.js'
export const SQUAT_SUMO_CONFIG = {
  requiredIndices: [11, 12, 23, 24, 27, 28], requiredSideIndices: [23, 25, 27],
  validate: (p) => spread(p,27,28)>1.4,
  upThreshold: 165,
  downThreshold: 95,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class SquatSumoAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...SQUAT_SUMO_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createSquatSumoAnalyzer(config = {}) {
  return new SquatSumoAnalyzer(config)
}
