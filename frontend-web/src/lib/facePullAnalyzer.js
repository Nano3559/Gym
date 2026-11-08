import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

import { sideIndex, bodyScale } from './poseMetrics.js'
export const FACE_PULL_CONFIG = {
  requiredIndices: [0, 11, 12, 23, 24], requiredSideIndices: [11, 13, 15],
  validate: (p,a) => Math.abs(p[sideIndex(15,a)].y-p[0].y)/bodyScale(p)<1.2,
  upThreshold: 160,
  downThreshold: 70,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class FacePullAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...FACE_PULL_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createFacePullAnalyzer(config = {}) {
  return new FacePullAnalyzer(config)
}
