import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const PIKE_PUSHUP_CONFIG = {
  upThreshold: 165,
  downThreshold: 80,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class PikePushupAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...PIKE_PUSHUP_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createPikePushupAnalyzer(config = {}) {
  return new PikePushupAnalyzer(config)
}
