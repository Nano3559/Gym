import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const BUTT_KICKS_CONFIG = {
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

export class ButtKicksAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...BUTT_KICKS_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 29, timestamp)
  }
}

export function createButtKicksAnalyzer(config = {}) {
  return new ButtKicksAnalyzer(config)
}
