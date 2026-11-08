import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { sideIndex, joint } from './poseMetrics.js'
export const HOLLOW_HOLD_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [], requiredSideIndices: [11, 23, 27],
  metric: (p,a) => (joint(p,11,23,27,a)>=150 && joint(p,11,23,27,a)<=165 && p[sideIndex(27,a)].y<p[sideIndex(23,a)].y) ? 1 : 0,
}
export class HollowHoldAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...HOLLOW_HOLD_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createHollowHoldAnalyzer(config={}) { return new HollowHoldAnalyzer(config) }
