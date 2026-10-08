import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const SKATER_JUMP_CONFIG = {
  axis: 'x',
  threshold: 0.05,
  resetOffset: 0.02,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class SkaterJumpAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...SKATER_JUMP_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, timestamp)
  }
}

export function createSkaterJumpAnalyzer(config = {}) {
  return new SkaterJumpAnalyzer(config)
}
