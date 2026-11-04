import { AlternatingAnalyzer } from './AlternatingAnalyzer.js'
import { bodyScale } from './poseMetrics.js'
export const WU_TORSO_TWIST_CONFIG = {
  requiredIndices: [11,12,23,24], threshold: 0.15, resetOffset: 0.3, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p) => (p[11].x-p[23].x)/bodyScale(p),
}
export class WuTorsoTwistAnalyzer extends AlternatingAnalyzer {
  constructor(config = {}) { super({ ...WU_TORSO_TWIST_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createWuTorsoTwistAnalyzer(config = {}) { return new WuTorsoTwistAnalyzer(config) }
