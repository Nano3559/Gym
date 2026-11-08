import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

import { horizontal, spread } from './poseMetrics.js'
export const PUSHUP_WIDE_CONFIG = {
  requiredIndices: [11, 12, 23, 24, 15, 16], requiredSideIndices: [11, 13, 15, 23],
  validate: (p) => spread(p,15,16)>1.2 && horizontal(p[11],p[23]),
  upThreshold: 160,
  downThreshold: 80,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class PushupWideAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...PUSHUP_WIDE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createPushupWideAnalyzer(config = {}) {
  return new PushupWideAnalyzer(config)
}
