import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { horizontal, sideIndex, joint } from './poseMetrics.js'
export const L_SIT_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28], 
  metric: (p,a) => (joint(p,11,23,27,a)>=80 && joint(p,11,23,27,a)<=100 && joint(p,23,25,27,a)>=160 && horizontal(p[sideIndex(23,a)],p[sideIndex(27,a)])) ? 1 : 0,
}
export class LSitAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...L_SIT_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createLSitAnalyzer(config={}) { return new LSitAnalyzer(config) }
