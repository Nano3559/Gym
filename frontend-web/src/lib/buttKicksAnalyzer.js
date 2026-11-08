import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { joint } from './poseMetrics.js'
export const BUTT_KICKS_CONFIG = {
  requiredIndices: [], requiredSideIndices: [23, 25, 27], threshold: 110, resetOffset: 25, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => 180 - joint(p,23,25,27,a),
}
export class ButtKicksAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...BUTT_KICKS_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createButtKicksAnalyzer(config = {}) { return new ButtKicksAnalyzer(config) }
