import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

import { joint, horizontal, sideIndex } from './poseMetrics.js'
export const PUSHUP_KNEES_CONFIG = {
  requiredIndices: [], requiredSideIndices: [11, 13, 15, 23, 25],
  validate: (p,a) => joint(p,11,23,25,a)>150 && horizontal(p[sideIndex(11,a)],p[sideIndex(23,a)]),
  upThreshold: 160,
  downThreshold: 75,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class PushupKneesAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...PUSHUP_KNEES_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createPushupKneesAnalyzer(config = {}) {
  return new PushupKneesAnalyzer(config)
}
