import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const WU_WORLDS_GREATEST_CONFIG = {
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

export class WuWorldsGreatestAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...WU_WORLDS_GREATEST_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, timestamp)
  }
}

export function createWuWorldsGreatestAnalyzer(config = {}) {
  return new WuWorldsGreatestAnalyzer(config)
}
