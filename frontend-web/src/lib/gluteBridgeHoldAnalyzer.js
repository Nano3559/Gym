import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const GLUTE_BRIDGE_HOLD_CONFIG = {
  targetSeconds: 30,
  validMin: 165,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class GluteBridgeHoldAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...GLUTE_BRIDGE_HOLD_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createGluteBridgeHoldAnalyzer(config = {}) {
  return new GluteBridgeHoldAnalyzer(config)
}
