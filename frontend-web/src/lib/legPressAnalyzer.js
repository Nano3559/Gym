import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const LEG_PRESS_CONFIG = {
  upThreshold: 90,
  downThreshold: 160,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class LegPressAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...LEG_PRESS_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createLegPressAnalyzer(config = {}) {
  return new LegPressAnalyzer(config)
}
