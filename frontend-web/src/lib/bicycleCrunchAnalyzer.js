import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { distance, bodyScale, sideIndex } from './poseMetrics.js'
export const BICYCLE_CRUNCH_CONFIG = {
  requiredIndices: [11,12,23,24,13,14,25,26], threshold: 0.45, resetOffset: 0.35, direction: 'decrease',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => distance(p[sideIndex(13,a)], p[sideIndex(26,a)]) / bodyScale(p),
}
export class BicycleCrunchAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...BICYCLE_CRUNCH_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createBicycleCrunchAnalyzer(config = {}) { return new BicycleCrunchAnalyzer(config) }
