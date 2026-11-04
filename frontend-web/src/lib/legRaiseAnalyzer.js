import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const LEG_RAISE_CONFIG = {
  upThreshold: 180,
  downThreshold: 90,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class LegRaiseAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...LEG_RAISE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createLegRaiseAnalyzer(config = {}) {
  return new LegRaiseAnalyzer(config)
}
