import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { sideIndex, joint } from './poseMetrics.js'
export const CHIN_HOLD_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [0], requiredSideIndices: [11, 13, 15],
  metric: (p,a) => (joint(p,11,13,15,a)>=80 && joint(p,11,13,15,a)<=100 && p[0].y<p[sideIndex(15,a)].y) ? 1 : 0,
}
export class ChinHoldAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...CHIN_HOLD_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createChinHoldAnalyzer(config={}) { return new ChinHoldAnalyzer(config) }
