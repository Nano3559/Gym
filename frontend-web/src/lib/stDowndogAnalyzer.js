import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { joint } from './poseMetrics.js'
export const ST_DOWNDOG_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28,13,14,15,16], 
  metric: (p,a) => (joint(p,11,23,27,a)>=70 && joint(p,11,23,27,a)<=100 && joint(p,23,25,27,a)>160 && joint(p,11,13,15,a)>160) ? 1 : 0,
}
export class StDowndogAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_DOWNDOG_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStDowndogAnalyzer(config={}) { return new StDowndogAnalyzer(config) }
