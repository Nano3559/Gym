import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { angleAt, horizontal, sideIndex, joint } from './poseMetrics.js'
export const BIRD_DOG_HOLD_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [], requiredSideIndices: [15, 11, 23, 12, 24, 28],
  metric: (p,a) => (joint(p,15,11,23,a)>=165 && angleAt(p[sideIndex(12,a)],p[sideIndex(24,a)],p[sideIndex(28,a)])>=165 && horizontal(p[sideIndex(11,a)],p[sideIndex(23,a)])) ? 1 : 0,
}
export class BirdDogHoldAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...BIRD_DOG_HOLD_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createBirdDogHoldAnalyzer(config={}) { return new BirdDogHoldAnalyzer(config) }
