import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const LAT_PULLDOWN_CONFIG = {
  upThreshold: 160,
  downThreshold: 55,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class LatPulldownAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...LAT_PULLDOWN_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createLatPulldownAnalyzer(config = {}) {
  return new LatPulldownAnalyzer(config)
}
