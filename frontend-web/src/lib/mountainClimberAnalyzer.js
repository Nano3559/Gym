import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const MOUNTAIN_CLIMBER_CONFIG = {
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

export class MountainClimberAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...MOUNTAIN_CLIMBER_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 25, timestamp)
  }
}

export function createMountainClimberAnalyzer(config = {}) {
  return new MountainClimberAnalyzer(config)
}
