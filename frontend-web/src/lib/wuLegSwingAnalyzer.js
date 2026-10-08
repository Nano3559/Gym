import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const WU_LEG_SWING_CONFIG = {
  upThreshold: 0,
  downThreshold: 45,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class WuLegSwingAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...WU_LEG_SWING_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createWuLegSwingAnalyzer(config = {}) {
  return new WuLegSwingAnalyzer(config)
}
