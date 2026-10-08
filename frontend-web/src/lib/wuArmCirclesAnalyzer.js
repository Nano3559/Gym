import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const WU_ARM_CIRCLES_CONFIG = {
  axis: 'x',
  threshold: 0.05,
  resetOffset: 0.02,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class WuArmCirclesAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...WU_ARM_CIRCLES_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 15, timestamp)
  }
}

export function createWuArmCirclesAnalyzer(config = {}) {
  return new WuArmCirclesAnalyzer(config)
}
