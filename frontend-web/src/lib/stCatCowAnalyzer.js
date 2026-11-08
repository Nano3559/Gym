import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { horizontal, joint, sideIndex } from './poseMetrics.js'
export const ST_CAT_COW_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [], requiredSideIndices: [11, 23, 25],
  metric: (p,a) => ((() => { const value=joint(p,11,23,25,a); const moving=a.previousCurve!=null && Math.abs(value-a.previousCurve)>0.05; a.previousCurve=value; return moving && horizontal(p[sideIndex(11,a)],p[sideIndex(23,a)]); })()) ? 1 : 0,
}
export class StCatCowAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_CAT_COW_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStCatCowAnalyzer(config={}) { return new StCatCowAnalyzer(config) }
