import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { joint } from './poseMetrics.js'
export const WU_SHOULDER_DISLOCATE_CONFIG = {
  requiredIndices: [], requiredSideIndices: [11, 13, 15, 23], threshold: 165, resetOffset: 45, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => Math.min(joint(p,11,13,15,a),joint(p,23,11,15,a)),
}
export class WuShoulderDislocateAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...WU_SHOULDER_DISLOCATE_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createWuShoulderDislocateAnalyzer(config = {}) { return new WuShoulderDislocateAnalyzer(config) }
