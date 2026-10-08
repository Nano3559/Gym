import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const SUPERMAN_CONFIG = {
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

export class SupermanAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...SUPERMAN_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 15, timestamp)
  }
}

export function createSupermanAnalyzer(config = {}) {
  return new SupermanAnalyzer(config)
}
