import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { distance, bodyScale, sideIndex, joint } from './poseMetrics.js'
export const ST_HAMSTRING_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28,13,14,15,16], 
  metric: (p,a) => (joint(p,23,25,27,a)>=160 && distance(p[sideIndex(15,a)],p[sideIndex(27,a)])/bodyScale(p)<0.7) ? 1 : 0,
}
export class StHamstringAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_HAMSTRING_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStHamstringAnalyzer(config={}) { return new StHamstringAnalyzer(config) }
