import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { sideIndex } from './poseMetrics.js'
export const WU_LEG_SWING_CONFIG = {
  requiredIndices: [11,12,23,24,27,28], threshold: 30, resetOffset: 60, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => Math.atan2(p[sideIndex(27,a)].x-p[sideIndex(23,a)].x,p[sideIndex(27,a)].y-p[sideIndex(23,a)].y)*180/Math.PI,
}
export class WuLegSwingAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...WU_LEG_SWING_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createWuLegSwingAnalyzer(config = {}) { return new WuLegSwingAnalyzer(config) }
