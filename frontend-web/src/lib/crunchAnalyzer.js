import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const CRUNCH_CONFIG = {
  upThreshold: 180,
  downThreshold: 60,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class CrunchAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...CRUNCH_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createCrunchAnalyzer(config = {}) {
  return new CrunchAnalyzer(config)
}
