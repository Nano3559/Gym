import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const FIRE_HYDRANT_CONFIG = {
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

export class FireHydrantAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...FIRE_HYDRANT_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createFireHydrantAnalyzer(config = {}) {
  return new FireHydrantAnalyzer(config)
}
