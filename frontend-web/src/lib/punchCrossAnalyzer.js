import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const PUNCH_CROSS_CONFIG = {
  // Guardia con el codo flexionado → extensión → regreso a la guardia.
  upThreshold: 90,
  downThreshold: 160,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class PunchCrossAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...PUNCH_CROSS_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createPunchCrossAnalyzer(config = {}) {
  return new PunchCrossAnalyzer(config)
}
