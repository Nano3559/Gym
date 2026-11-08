import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { midPoint, tilt, sideIndex } from './poseMetrics.js'
export const ST_LAT_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11, 12, 23, 24], requiredSideIndices: [15, 11],
  metric: (p,a) => (p[sideIndex(15,a)].y<p[sideIndex(11,a)].y && tilt(midPoint(p[11],p[12]),midPoint(p[23],p[24]))>20) ? 1 : 0,
}
export class StLatAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_LAT_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStLatAnalyzer(config={}) { return new StLatAnalyzer(config) }
