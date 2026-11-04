import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { midPoint, tilt } from './poseMetrics.js'
export const ST_SIDE_BEND_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24], 
  metric: (p) => (tilt(midPoint(p[11],p[12]),midPoint(p[23],p[24]))>=30 && tilt(midPoint(p[11],p[12]),midPoint(p[23],p[24]))<=40) ? 1 : 0,
}
export class StSideBendAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_SIDE_BEND_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStSideBendAnalyzer(config={}) { return new StSideBendAnalyzer(config) }
