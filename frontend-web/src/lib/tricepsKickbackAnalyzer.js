import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

import { sideIndex, tilt } from './poseMetrics.js'
export const TRICEPS_KICKBACK_CONFIG = {
  requiredIndices: [], requiredSideIndices: [11, 13, 15, 23],
  validate: (p,a) => tilt(p[sideIndex(11,a)],p[sideIndex(23,a)])>30,
  upThreshold: 90,
  downThreshold: 160,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class TricepsKickbackAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...TRICEPS_KICKBACK_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createTricepsKickbackAnalyzer(config = {}) {
  return new TricepsKickbackAnalyzer(config)
}
