import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const LEG_EXTENSION_CONFIG = {
  upThreshold: 90,
  downThreshold: 170,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class LegExtensionAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...LEG_EXTENSION_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createLegExtensionAnalyzer(config = {}) {
  return new LegExtensionAnalyzer(config)
}
