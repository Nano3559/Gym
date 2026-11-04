import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { horizontal, sideIndex, joint } from './poseMetrics.js'
export const PLANK_FOREARM_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28,13,14,15,16], 
  metric: (p,a) => (joint(p,11,23,27,a)>=170 && joint(p,11,13,15,a)>70 && joint(p,11,13,15,a)<110 && horizontal(p[sideIndex(11,a)],p[sideIndex(27,a)])) ? 1 : 0,
}
export class PlankForearmAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...PLANK_FOREARM_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createPlankForearmAnalyzer(config={}) { return new PlankForearmAnalyzer(config) }
