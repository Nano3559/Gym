import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const WU_TORSO_TWIST_CONFIG = {
  axis: 'x',
  threshold: 0.05,
  resetOffset: 0.02,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class WuTorsoTwistAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...WU_TORSO_TWIST_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, timestamp)
  }
}

export function createWuTorsoTwistAnalyzer(config = {}) {
  return new WuTorsoTwistAnalyzer(config)
}
