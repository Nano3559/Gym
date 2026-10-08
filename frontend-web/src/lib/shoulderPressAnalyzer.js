import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const SHOULDER_PRESS_CONFIG = {
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

export class ShoulderPressAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...SHOULDER_PRESS_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 13, 11, 15, timestamp)
  }
}

export function createShoulderPressAnalyzer(config = {}) {
  return new ShoulderPressAnalyzer(config)
}
