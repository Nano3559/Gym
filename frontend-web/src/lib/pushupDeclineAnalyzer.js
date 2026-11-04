import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

import { joint, sideIndex } from './poseMetrics.js'
export const PUSHUP_DECLINE_CONFIG = {
  requiredIndices: [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28],
  validate: (p,a) => p[sideIndex(27,a)].y<p[sideIndex(15,a)].y && joint(p,11,23,27,a)>150,
  upThreshold: 160,
  downThreshold: 65,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class PushupDeclineAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...PUSHUP_DECLINE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createPushupDeclineAnalyzer(config = {}) {
  return new PushupDeclineAnalyzer(config)
}
