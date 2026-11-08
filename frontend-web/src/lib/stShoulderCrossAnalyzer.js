import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { bodyScale, sideIndex } from './poseMetrics.js'
export const ST_SHOULDER_CROSS_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11, 12, 23, 24], requiredSideIndices: [15, 12, 11],
  metric: (p,a) => ((p[sideIndex(15,a)].x-p[sideIndex(12,a)].x)*(p[sideIndex(11,a)].x-p[sideIndex(12,a)].x)<0 && Math.abs(p[sideIndex(15,a)].y-p[sideIndex(11,a)].y)/bodyScale(p)<0.5) ? 1 : 0,
}
export class StShoulderCrossAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_SHOULDER_CROSS_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStShoulderCrossAnalyzer(config={}) { return new StShoulderCrossAnalyzer(config) }
