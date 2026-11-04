import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { bodyScale, sideIndex } from './poseMetrics.js'
export const WU_MARCH_CONFIG = {
  requiredIndices: [11,12,23,24,25,26], threshold: -0.3, resetOffset: 0.3, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => (p[sideIndex(23,a)].y-p[sideIndex(25,a)].y)/bodyScale(p),
}
export class WuMarchAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...WU_MARCH_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createWuMarchAnalyzer(config = {}) { return new WuMarchAnalyzer(config) }
