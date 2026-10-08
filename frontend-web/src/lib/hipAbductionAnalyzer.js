import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const HIP_ABDUCTION_CONFIG = {
  upThreshold: 0,
  downThreshold: 30,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class HipAbductionAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...HIP_ABDUCTION_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createHipAbductionAnalyzer(config = {}) {
  return new HipAbductionAnalyzer(config)
}
