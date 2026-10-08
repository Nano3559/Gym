import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const SKULLCRUSHER_CONFIG = {
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

export class SkullcrusherAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...SKULLCRUSHER_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createSkullcrusherAnalyzer(config = {}) {
  return new SkullcrusherAnalyzer(config)
}
