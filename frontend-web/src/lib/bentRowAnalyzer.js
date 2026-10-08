import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const BENT_ROW_CONFIG = {
  upThreshold: 160,
  downThreshold: 60,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class BentRowAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...BENT_ROW_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createBentRowAnalyzer(config = {}) {
  return new BentRowAnalyzer(config)
}
