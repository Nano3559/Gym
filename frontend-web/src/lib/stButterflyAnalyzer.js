import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { spread } from './poseMetrics.js'
export const ST_BUTTERFLY_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28], 
  metric: (p) => (spread(p,27,28)<0.45 && spread(p,25,26)>0.8) ? 1 : 0,
}
export class StButterflyAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_BUTTERFLY_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStButterflyAnalyzer(config={}) { return new StButterflyAnalyzer(config) }
