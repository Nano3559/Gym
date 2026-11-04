import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const STEP_UP_CONFIG = {
  upThreshold: 100,
  downThreshold: 170,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class StepUpAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...STEP_UP_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createStepUpAnalyzer(config = {}) {
  return new StepUpAnalyzer(config)
}
