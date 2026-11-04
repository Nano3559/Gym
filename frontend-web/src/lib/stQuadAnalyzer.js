import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { tilt, sideIndex, joint } from './poseMetrics.js'
export const ST_QUAD_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28], 
  metric: (p,a) => (joint(p,23,25,27,a)<45 && tilt(p[sideIndex(11,a)],p[sideIndex(23,a)])<20) ? 1 : 0,
}
export class StQuadAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_QUAD_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStQuadAnalyzer(config={}) { return new StQuadAnalyzer(config) }
