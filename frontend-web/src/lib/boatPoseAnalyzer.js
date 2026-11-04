import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { sideIndex, joint } from './poseMetrics.js'
export const BOAT_POSE_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28], 
  metric: (p,a) => (joint(p,11,23,25,a)>=70 && joint(p,11,23,25,a)<=90 && p[sideIndex(27,a)].y<p[sideIndex(23,a)].y) ? 1 : 0,
}
export class BoatPoseAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...BOAT_POSE_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createBoatPoseAnalyzer(config={}) { return new BoatPoseAnalyzer(config) }
