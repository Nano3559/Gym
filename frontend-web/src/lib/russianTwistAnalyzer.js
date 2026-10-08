import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const RUSSIAN_TWIST_CONFIG = {
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

export class RussianTwistAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...RUSSIAN_TWIST_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, timestamp)
  }
}

export function createRussianTwistAnalyzer(config = {}) {
  return new RussianTwistAnalyzer(config)
}
