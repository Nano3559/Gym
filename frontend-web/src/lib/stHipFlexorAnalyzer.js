import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { bodyScale, sideIndex, joint } from './poseMetrics.js'
export const ST_HIP_FLEXOR_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28], 
  metric: (p,a) => (joint(p,23,25,27,a)>=80 && joint(p,23,25,27,a)<=100 && Math.abs(p[sideIndex(26,a)].y-p[sideIndex(27,a)].y)/bodyScale(p)<0.3) ? 1 : 0,
}
export class StHipFlexorAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_HIP_FLEXOR_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStHipFlexorAnalyzer(config={}) { return new StHipFlexorAnalyzer(config) }
