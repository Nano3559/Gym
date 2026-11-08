import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { distance, bodyScale, joint } from './poseMetrics.js'
export const WU_WORLDS_GREATEST_CONFIG = {
  requiredIndices: [11, 12, 23, 24, 15, 16, 27, 28], requiredSideIndices: [23, 25, 27], threshold: 0.3, resetOffset: 0.2, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => joint(p,23,25,27,a) < 110 && Math.min(distance(p[15],p[27]),distance(p[16],p[28]))/bodyScale(p) < 0.6 ? Math.abs(p[11].y-p[12].y)/bodyScale(p) : 0,
}
export class WuWorldsGreatestAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...WU_WORLDS_GREATEST_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createWuWorldsGreatestAnalyzer(config = {}) { return new WuWorldsGreatestAnalyzer(config) }
