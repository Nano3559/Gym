import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { midPoint, tilt, sideIndex } from './poseMetrics.js'
export const ST_NECK_SIDE_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [0,11,12,23,24], 
  metric: (p,a) => ((p[0].x-midPoint(p[11],p[12]).x)*(p[sideIndex(11,a)].x-midPoint(p[11],p[12]).x)>0 && tilt(p[0],midPoint(p[11],p[12]))>15 && tilt(p[0],midPoint(p[11],p[12]))<45) ? 1 : 0,
}
export class StNeckSideAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_NECK_SIDE_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStNeckSideAnalyzer(config={}) { return new StNeckSideAnalyzer(config) }
