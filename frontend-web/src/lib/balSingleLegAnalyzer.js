import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { midPoint, bodyScale, tilt, sideIndex } from './poseMetrics.js'
export const BAL_SINGLE_LEG_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11, 12, 23, 24, 27, 28], minLift: 0.25,
  metric: (p,a) => ((p[sideIndex(28,a)].y-p[sideIndex(27,a)].y)/bodyScale(p) > a.config.minLift && tilt(midPoint(p[11],p[12]),midPoint(p[23],p[24])) < 15) ? 1 : 0,
}
export class BalSingleLegAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...BAL_SINGLE_LEG_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createBalSingleLegAnalyzer(config={}) { return new BalSingleLegAnalyzer(config) }
