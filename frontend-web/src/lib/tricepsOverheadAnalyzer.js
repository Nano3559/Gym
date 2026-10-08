import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const TRICEPS_OVERHEAD_CONFIG = {
  upThreshold: 170,
  downThreshold: 60,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class TricepsOverheadAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...TRICEPS_OVERHEAD_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createTricepsOverheadAnalyzer(config = {}) {
  return new TricepsOverheadAnalyzer(config)
}
