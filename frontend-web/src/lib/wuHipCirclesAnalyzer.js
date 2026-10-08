import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const WU_HIP_CIRCLES_CONFIG = {
  axis: 'x',
  threshold: 0.05,
  resetOffset: 0.02,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class WuHipCirclesAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...WU_HIP_CIRCLES_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, timestamp)
  }
}

export function createWuHipCirclesAnalyzer(config = {}) {
  return new WuHipCirclesAnalyzer(config)
}
