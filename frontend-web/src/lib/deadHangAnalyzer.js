import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { sideIndex, joint } from './poseMetrics.js'
export const DEAD_HANG_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [], requiredSideIndices: [11, 13, 15],
  metric: (p,a) => (joint(p,11,13,15,a)>=165 && p[sideIndex(15,a)].y<p[sideIndex(11,a)].y) ? 1 : 0,
}
export class DeadHangAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...DEAD_HANG_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createDeadHangAnalyzer(config={}) { return new DeadHangAnalyzer(config) }
