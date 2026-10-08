import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const HIP_THRUST_CONFIG = {
  upThreshold: 100,
  downThreshold: 175,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class HipThrustAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...HIP_THRUST_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createHipThrustAnalyzer(config = {}) {
  return new HipThrustAnalyzer(config)
}
