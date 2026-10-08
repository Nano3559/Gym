import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const PUSHUP_KNEES_CONFIG = {
  upThreshold: 160,
  downThreshold: 75,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class PushupKneesAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...PUSHUP_KNEES_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createPushupKneesAnalyzer(config = {}) {
  return new PushupKneesAnalyzer(config)
}
