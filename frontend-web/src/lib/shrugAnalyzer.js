import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { midPoint, bodyScale } from './poseMetrics.js'
export const SHRUG_CONFIG = {
  requiredIndices: [0,11,12,23,24], threshold: 0.45, resetOffset: 0.12, direction: 'decrease',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p) => (midPoint(p[11],p[12]).y-p[0].y)/bodyScale(p),
}
export class ShrugAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...SHRUG_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createShrugAnalyzer(config = {}) { return new ShrugAnalyzer(config) }
