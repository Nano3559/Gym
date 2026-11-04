import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const FRONT_RAISE_CONFIG = {
  upThreshold: 15,
  downThreshold: 90,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class FrontRaiseAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...FRONT_RAISE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 11, 13, timestamp)
  }
}

export function createFrontRaiseAnalyzer(config = {}) {
  return new FrontRaiseAnalyzer(config)
}
