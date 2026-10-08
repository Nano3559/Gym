import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const TOE_TOUCH_CONFIG = {
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

export class ToeTouchAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...TOE_TOUCH_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 15, timestamp)
  }
}

export function createToeTouchAnalyzer(config = {}) {
  return new ToeTouchAnalyzer(config)
}
