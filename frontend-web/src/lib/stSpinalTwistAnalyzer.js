import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { bodyScale, joint } from './poseMetrics.js'
export const ST_SPINAL_TWIST_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11, 12, 23, 24], requiredSideIndices: [11, 23, 25],
  metric: (p,a) => (Math.abs((p[11].x-p[23].x)/bodyScale(p))>0.2 && joint(p,11,23,25,a)<120) ? 1 : 0,
}
export class StSpinalTwistAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_SPINAL_TWIST_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStSpinalTwistAnalyzer(config={}) { return new StSpinalTwistAnalyzer(config) }
