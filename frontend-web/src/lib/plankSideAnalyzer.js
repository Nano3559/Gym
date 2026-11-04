import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { horizontal, sideIndex, joint } from './poseMetrics.js'
export const PLANK_SIDE_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28], 
  metric: (p,a) => (joint(p,11,23,27,a)>=165 && horizontal(p[sideIndex(11,a)],p[sideIndex(27,a)])) ? 1 : 0,
}
export class PlankSideAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...PLANK_SIDE_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createPlankSideAnalyzer(config={}) { return new PlankSideAnalyzer(config) }
