import { IsometricAnalyzer } from './IsometricAnalyzer.js'

export const BIRD_DOG_HOLD_CONFIG = {
  targetSeconds: 30,
  validMin: 165,
  validMax: 180,
  minVisibility: 0.5,
  smootherWindow: 3,
  trackingTimeoutMs: 900,
}

export class BirdDogHoldAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) {
    super({ ...BIRD_DOG_HOLD_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createBirdDogHoldAnalyzer(config = {}) {
  return new BirdDogHoldAnalyzer(config)
}
