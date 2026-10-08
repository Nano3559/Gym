import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const BURPEE_CONFIG = {
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

export class BurpeeAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...BURPEE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, timestamp)
  }
}

export function createBurpeeAnalyzer(config = {}) {
  return new BurpeeAnalyzer(config)
}
