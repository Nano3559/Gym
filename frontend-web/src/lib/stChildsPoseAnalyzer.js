import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { distance, bodyScale, sideIndex, joint } from './poseMetrics.js'
export const ST_CHILDS_POSE_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11, 12, 23, 24], requiredSideIndices: [23, 29, 11, 13, 15],
  metric: (p,a) => (distance(p[sideIndex(23,a)],p[sideIndex(29,a)])/bodyScale(p)<0.8 && joint(p,11,13,15,a)>160) ? 1 : 0,
}
export class StChildsPoseAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_CHILDS_POSE_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStChildsPoseAnalyzer(config={}) { return new StChildsPoseAnalyzer(config) }
