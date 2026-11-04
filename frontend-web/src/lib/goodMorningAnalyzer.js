import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const GOOD_MORNING_CONFIG = {
  upThreshold: 175,
  downThreshold: 95,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class GoodMorningAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...GOOD_MORNING_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createGoodMorningAnalyzer(config = {}) {
  return new GoodMorningAnalyzer(config)
}
