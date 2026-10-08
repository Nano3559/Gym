import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const SQUAT_PISTOL_CONFIG = {
  upThreshold: 170,
  downThreshold: 80,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class SquatPistolAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...SQUAT_PISTOL_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createSquatPistolAnalyzer(config = {}) {
  return new SquatPistolAnalyzer(config)
}
