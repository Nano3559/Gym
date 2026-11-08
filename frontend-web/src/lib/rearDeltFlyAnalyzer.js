import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

import { sideIndex, tilt } from './poseMetrics.js'
export const REAR_DELT_FLY_CONFIG = {
  requiredIndices: [], requiredSideIndices: [23, 11, 13],
  validate: (p,a) => tilt(p[sideIndex(11,a)],p[sideIndex(23,a)])>30,
  upThreshold: 25,
  downThreshold: 85,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class RearDeltFlyAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...REAR_DELT_FLY_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 11, 13, timestamp)
  }
}

export function createRearDeltFlyAnalyzer(config = {}) {
  return new RearDeltFlyAnalyzer(config)
}
