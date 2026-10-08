import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const BOAT_POSE_CONFIG = {
  targetSeconds: 30,
  validMin: 70,
  validMax: 90,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class BoatPoseAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...BOAT_POSE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createBoatPoseAnalyzer(config = {}) {
  return new BoatPoseAnalyzer(config)
}
