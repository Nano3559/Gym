import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { bodyScale, tilt, sideIndex, joint } from './poseMetrics.js'
export const ST_CALF_WALL_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28,29,30,31,32], 
  metric: (p,a) => (joint(p,23,25,27,a)>=160 && tilt(p[sideIndex(11,a)],p[sideIndex(23,a)])>10 && tilt(p[sideIndex(11,a)],p[sideIndex(23,a)])<45 && Math.abs(p[sideIndex(29,a)].y-p[sideIndex(31,a)].y)/bodyScale(p)<0.12) ? 1 : 0,
}
export class StCalfWallAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_CALF_WALL_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStCalfWallAnalyzer(config={}) { return new StCalfWallAnalyzer(config) }
