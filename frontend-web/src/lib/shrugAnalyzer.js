import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const SHRUG_CONFIG = {
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

export class ShrugAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...SHRUG_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, timestamp)
  }
}

export function createShrugAnalyzer(config = {}) {
  return new ShrugAnalyzer(config)
}
