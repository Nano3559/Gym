import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const V_UP_CONFIG = {
  upThreshold: 170,
  downThreshold: 70,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class VUpAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...V_UP_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createVUpAnalyzer(config = {}) {
  return new VUpAnalyzer(config)
}
