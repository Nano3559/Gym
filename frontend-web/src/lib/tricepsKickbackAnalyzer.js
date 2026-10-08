import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const TRICEPS_KICKBACK_CONFIG = {
  upThreshold: 90,
  downThreshold: 170,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class TricepsKickbackAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...TRICEPS_KICKBACK_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createTricepsKickbackAnalyzer(config = {}) {
  return new TricepsKickbackAnalyzer(config)
}
