import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

import { sideIndex, tilt } from './poseMetrics.js'
export const BENT_ROW_CONFIG = {
  requiredIndices: [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28],
  validate: (p,a) => tilt(p[sideIndex(11,a)],p[sideIndex(23,a)])>30,
  upThreshold: 160,
  downThreshold: 60,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class BentRowAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...BENT_ROW_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createBentRowAnalyzer(config = {}) {
  return new BentRowAnalyzer(config)
}
