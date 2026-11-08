import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { midPoint, bodyScale, spread } from './poseMetrics.js'
export const ST_FROG_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11, 12, 23, 24, 25, 26],
  metric: (p) => (spread(p,25,26)>1.3 && Math.abs(midPoint(p[23],p[24]).y-midPoint(p[25],p[26]).y)/bodyScale(p)<0.5) ? 1 : 0,
}
export class StFrogAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_FROG_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStFrogAnalyzer(config={}) { return new StFrogAnalyzer(config) }
