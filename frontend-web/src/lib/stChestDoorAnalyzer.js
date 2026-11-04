import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { bodyScale, sideIndex, joint } from './poseMetrics.js'
export const ST_CHEST_DOOR_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28,13,14,15,16], 
  metric: (p,a) => (joint(p,11,13,15,a)>=80 && joint(p,11,13,15,a)<=100 && Math.abs(p[sideIndex(13,a)].y-p[sideIndex(11,a)].y)/bodyScale(p)<0.25) ? 1 : 0,
}
export class StChestDoorAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_CHEST_DOOR_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStChestDoorAnalyzer(config={}) { return new StChestDoorAnalyzer(config) }
