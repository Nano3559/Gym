import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const PULLUP_CONFIG = {
  upThreshold: 165,
  downThreshold: 50,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class PullupAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...PULLUP_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createPullupAnalyzer(config = {}) {
  return new PullupAnalyzer(config)
}
