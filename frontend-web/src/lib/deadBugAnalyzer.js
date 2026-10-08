import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const DEAD_BUG_CONFIG = {
  axis: 'y',
  threshold: 0.05,
  resetOffset: 0.02,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class DeadBugAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...DEAD_BUG_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 15, timestamp)
  }
}

export function createDeadBugAnalyzer(config = {}) {
  return new DeadBugAnalyzer(config)
}
