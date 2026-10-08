import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const PUSHUP_WIDE_CONFIG = {
  upThreshold: 160,
  downThreshold: 80,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class PushupWideAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...PUSHUP_WIDE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createPushupWideAnalyzer(config = {}) {
  return new PushupWideAnalyzer(config)
}
