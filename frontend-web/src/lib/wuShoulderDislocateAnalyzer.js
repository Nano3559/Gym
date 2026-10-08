import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const WU_SHOULDER_DISLOCATE_CONFIG = {
  upThreshold: 165,
  downThreshold: 90,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class WuShoulderDislocateAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...WU_SHOULDER_DISLOCATE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createWuShoulderDislocateAnalyzer(config = {}) {
  return new WuShoulderDislocateAnalyzer(config)
}
