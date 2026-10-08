import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const SIDE_LEG_RAISE_CONFIG = {
  upThreshold: 5,
  downThreshold: 40,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class SideLegRaiseAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...SIDE_LEG_RAISE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createSideLegRaiseAnalyzer(config = {}) {
  return new SideLegRaiseAnalyzer(config)
}
