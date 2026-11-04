import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { sideIndex, joint } from './poseMetrics.js'
export const ST_STANDING_FORWARD_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28], 
  metric: (p,a) => (joint(p,23,25,27,a)>=170 && p[sideIndex(11,a)].y>p[sideIndex(23,a)].y) ? 1 : 0,
}
export class StStandingForwardAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_STANDING_FORWARD_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStStandingForwardAnalyzer(config={}) { return new StStandingForwardAnalyzer(config) }
