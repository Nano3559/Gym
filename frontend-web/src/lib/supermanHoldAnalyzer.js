import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { sideIndex } from './poseMetrics.js'
export const SUPERMAN_HOLD_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28,13,14,15,16], 
  metric: (p,a) => (p[sideIndex(15,a)].y<p[sideIndex(11,a)].y-0.03 && p[sideIndex(27,a)].y<p[sideIndex(23,a)].y-0.03) ? 1 : 0,
}
export class SupermanHoldAnalyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...SUPERMAN_HOLD_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createSupermanHoldAnalyzer(config={}) { return new SupermanHoldAnalyzer(config) }
