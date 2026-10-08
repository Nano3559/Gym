import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const SIDE_BEND_CONFIG = {
  upThreshold: 0,
  downThreshold: 30,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class SideBendAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...SIDE_BEND_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createSideBendAnalyzer(config = {}) {
  return new SideBendAnalyzer(config)
}
