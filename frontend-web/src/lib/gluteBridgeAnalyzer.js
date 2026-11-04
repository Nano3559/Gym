import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const GLUTE_BRIDGE_CONFIG = {
  upThreshold: 110,
  downThreshold: 175,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class GluteBridgeAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...GLUTE_BRIDGE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createGluteBridgeAnalyzer(config = {}) {
  return new GluteBridgeAnalyzer(config)
}
