import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const SINGLE_ARM_ROW_CONFIG = {
  upThreshold: 160,
  downThreshold: 60,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class SingleArmRowAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...SINGLE_ARM_ROW_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createSingleArmRowAnalyzer(config = {}) {
  return new SingleArmRowAnalyzer(config)
}
