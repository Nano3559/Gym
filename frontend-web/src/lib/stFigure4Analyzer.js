import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_FIGURE4_CONFIG = {
  targetSeconds: 30,
  validMin: 40,
  validMax: 80,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StFigure4Analyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_FIGURE4_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createStFigure4Analyzer(config = {}) {
  return new StFigure4Analyzer(config)
}
