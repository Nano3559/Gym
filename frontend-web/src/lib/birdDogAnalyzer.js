import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const BIRD_DOG_CONFIG = {
  upThreshold: 165,
  downThreshold: 120,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class BirdDogAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...BIRD_DOG_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 27, timestamp)
  }
}

export function createBirdDogAnalyzer(config = {}) {
  return new BirdDogAnalyzer(config)
}
