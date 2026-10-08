import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'

export const FLUTTER_KICK_CONFIG = {
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

export class FlutterKickAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) {
    super({ ...FLUTTER_KICK_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 27, timestamp)
  }
}

export function createFlutterKickAnalyzer(config = {}) {
  return new FlutterKickAnalyzer(config)
}
