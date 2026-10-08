import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const LUNGE_REVERSE_CONFIG = {
  upThreshold: 170,
  downThreshold: 90,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class LungeReverseAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...LUNGE_REVERSE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createLungeReverseAnalyzer(config = {}) {
  return new LungeReverseAnalyzer(config)
}
