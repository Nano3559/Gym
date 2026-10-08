import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const ST_CHEST_DOOR_CONFIG = {
  targetSeconds: 30,
  validMin: 80,
  validMax: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class StChestDoorAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...ST_CHEST_DOOR_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createStChestDoorAnalyzer(config = {}) {
  return new StChestDoorAnalyzer(config)
}
