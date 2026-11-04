import { AlternatingAnalyzer } from './AlternatingAnalyzer.js'
import { midPoint } from './poseMetrics.js'
export const SIDE_BEND_CONFIG = {
  requiredIndices: [11,12,23,24], threshold: 30, resetOffset: 20, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p) => Math.atan2(midPoint(p[11],p[12]).x-midPoint(p[23],p[24]).x,midPoint(p[23],p[24]).y-midPoint(p[11],p[12]).y)*180/Math.PI,
}
export class SideBendAnalyzer extends AlternatingAnalyzer {
  constructor(config = {}) { super({ ...SIDE_BEND_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createSideBendAnalyzer(config = {}) { return new SideBendAnalyzer(config) }
