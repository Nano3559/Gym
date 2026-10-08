import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const SQUAT_COSSACK_CONFIG = {
  upThreshold: 170,
  downThreshold: 90,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class SquatCossackAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...SQUAT_COSSACK_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createSquatCossackAnalyzer(config = {}) {
  return new SquatCossackAnalyzer(config)
}
