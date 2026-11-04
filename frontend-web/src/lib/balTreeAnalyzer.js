import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { distance, bodyScale, spread, sideIndex, joint } from './poseMetrics.js'
export const BAL_TREE_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28,13,14,15,16], 
  metric: (p,a) => (joint(p,23,25,27,a)<120 && distance(p[sideIndex(27,a)],p[sideIndex(26,a)])/bodyScale(p)<0.6 && spread(p,15,16)<0.5) ? 1 : 0,
}
export class BalTreeAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...BAL_TREE_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createBalTreeAnalyzer(config={}) { return new BalTreeAnalyzer(config) }
