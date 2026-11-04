import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const SITUP_CONFIG = {
  upThreshold: 130,
  downThreshold: 60,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class SitupAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...SITUP_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createSitupAnalyzer(config = {}) {
  return new SitupAnalyzer(config)
}
