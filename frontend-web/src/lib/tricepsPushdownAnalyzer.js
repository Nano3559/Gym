import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const TRICEPS_PULLDOWN_CONFIG = {
  upThreshold: 45,
  downThreshold: 165,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class TricepsPushdownAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...TRICEPS_PULLDOWN_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createTricepsPushdownAnalyzer(config = {}) {
  return new TricepsPushdownAnalyzer(config)
}
