import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { bodyScale, sideIndex } from './poseMetrics.js'
export const FIRE_HYDRANT_CONFIG = {
  requiredIndices: [11,12,23,24,25,26], threshold: 0.6, resetOffset: 0.3, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => Math.abs(p[sideIndex(25,a)].x-p[sideIndex(23,a)].x)/bodyScale(p),
}
export class FireHydrantAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...FIRE_HYDRANT_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createFireHydrantAnalyzer(config = {}) { return new FireHydrantAnalyzer(config) }
