import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const ARNOLD_PRESS_CONFIG = {
  upThreshold: 60,
  downThreshold: 165,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class ArnoldPressAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...ARNOLD_PRESS_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createArnoldPressAnalyzer(config = {}) {
  return new ArnoldPressAnalyzer(config)
}
