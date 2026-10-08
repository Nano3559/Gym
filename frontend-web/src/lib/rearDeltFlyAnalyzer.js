import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const REAR_DELT_FLY_CONFIG = {
  upThreshold: 20,
  downThreshold: 85,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class RearDeltFlyAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...REAR_DELT_FLY_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 11, 13, timestamp)
  }
}

export function createRearDeltFlyAnalyzer(config = {}) {
  return new RearDeltFlyAnalyzer(config)
}
