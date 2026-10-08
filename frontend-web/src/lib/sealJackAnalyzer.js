import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const SEAL_JACK_CONFIG = {
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

export class SealJackAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...SEAL_JACK_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 27, timestamp)
  }
}

export function createSealJackAnalyzer(config = {}) {
  return new SealJackAnalyzer(config)
}
