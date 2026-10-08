import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const CHAIR_POSE_CONFIG = {
  targetSeconds: 30,
  validMin: 100,
  validMax: 130,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class ChairPoseAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...CHAIR_POSE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createChairPoseAnalyzer(config = {}) {
  return new ChairPoseAnalyzer(config)
}
