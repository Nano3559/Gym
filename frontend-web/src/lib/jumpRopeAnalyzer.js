import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const JUMP_ROPE_CONFIG = {
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

export class JumpRopeAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...JUMP_ROPE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, timestamp)
  }
}

export function createJumpRopeAnalyzer(config = {}) {
  return new JumpRopeAnalyzer(config)
}
