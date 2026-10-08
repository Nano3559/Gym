import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const BICYCLE_CRUNCH_CONFIG = {
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

export class BicycleCrunchAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...BICYCLE_CRUNCH_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 13, timestamp)
  }
}

export function createBicycleCrunchAnalyzer(config = {}) {
  return new BicycleCrunchAnalyzer(config)
}
