import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

import { joint } from './poseMetrics.js'
export const DEADLIFT_RDL_CONFIG = {
  requiredIndices: [], requiredSideIndices: [11, 23, 25, 27],
  validate: (p,a) => joint(p,23,25,27,a)>130,
  upThreshold: 165,
  downThreshold: 100,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class DeadliftRdlAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...DEADLIFT_RDL_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createDeadliftRdlAnalyzer(config = {}) {
  return new DeadliftRdlAnalyzer(config)
}
