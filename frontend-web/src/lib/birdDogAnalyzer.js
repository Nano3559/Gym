import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { angleAt, sideIndex, joint } from './poseMetrics.js'
export const BIRD_DOG_CONFIG = {
  requiredIndices: [], requiredSideIndices: [15, 11, 23, 12, 24, 28], threshold: 165, resetOffset: 30, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => Math.min(joint(p,15,11,23,a), angleAt(p[sideIndex(12,a)],p[sideIndex(24,a)],p[sideIndex(28,a)])),
}
export class BirdDogAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...BIRD_DOG_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createBirdDogAnalyzer(config = {}) { return new BirdDogAnalyzer(config) }
