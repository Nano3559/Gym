import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const DUMBBELL_FLY_CONFIG = {
  upThreshold: 150,
  downThreshold: 100,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class DumbbellFlyAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...DUMBBELL_FLY_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createDumbbellFlyAnalyzer(config = {}) {
  return new DumbbellFlyAnalyzer(config)
}
