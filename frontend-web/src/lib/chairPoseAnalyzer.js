import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { joint } from './poseMetrics.js'
export const CHAIR_POSE_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11, 12, 15, 16], requiredSideIndices: [23, 25, 27],
  metric: (p,a) => (joint(p,23,25,27,a)>=100 && joint(p,23,25,27,a)<=130 && p[15].y<p[11].y && p[16].y<p[12].y) ? 1 : 0,
}
export class ChairPoseAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...CHAIR_POSE_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createChairPoseAnalyzer(config={}) { return new ChairPoseAnalyzer(config) }
