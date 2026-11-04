import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { angleAt, sideIndex, joint } from './poseMetrics.js'
export const ST_PIGEON_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28], 
  metric: (p,a) => (joint(p,23,25,27,a)<90 && angleAt(p[sideIndex(24,a)],p[sideIndex(26,a)],p[sideIndex(28,a)])>155) ? 1 : 0,
}
export class StPigeonAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_PIGEON_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStPigeonAnalyzer(config={}) { return new StPigeonAnalyzer(config) }
