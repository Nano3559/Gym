import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const FACE_PULL_CONFIG = {
  upThreshold: 165,
  downThreshold: 70,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class FacePullAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...FACE_PULL_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createFacePullAnalyzer(config = {}) {
  return new FacePullAnalyzer(config)
}
