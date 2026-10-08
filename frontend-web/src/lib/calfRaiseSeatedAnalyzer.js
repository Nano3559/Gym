import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const CALF_RAISE_SEATED_CONFIG = {
  upThreshold: 90,
  downThreshold: 130,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class CalfRaiseSeatedAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...CALF_RAISE_SEATED_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 25, 27, 31, timestamp)
  }
}

export function createCalfRaiseSeatedAnalyzer(config = {}) {
  return new CalfRaiseSeatedAnalyzer(config)
}
