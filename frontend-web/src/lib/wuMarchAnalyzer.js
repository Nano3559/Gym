import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const WU_MARCH_CONFIG = {
  axis: 'y',
  threshold: 0.05,
  resetOffset: 0.02,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class WuMarchAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...WU_MARCH_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 25, timestamp)
  }
}

export function createWuMarchAnalyzer(config = {}) {
  return new WuMarchAnalyzer(config)
}
