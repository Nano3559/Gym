import { AlternatingAnalyzer } from './AlternatingAnalyzer.js'
import { midPoint, bodyScale } from './poseMetrics.js'
export const SKATER_JUMP_CONFIG = {
  requiredIndices: [11,12,23,24,27,28], threshold: 0.5, resetOffset: 1, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => (() => { const x=midPoint(p[23],p[24]).x; if(a.baselineX == null) a.baselineX=x; return (x-a.baselineX)/bodyScale(p) })(),
}
export class SkaterJumpAnalyzer extends AlternatingAnalyzer {
  constructor(config = {}) { super({ ...SKATER_JUMP_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createSkaterJumpAnalyzer(config = {}) { return new SkaterJumpAnalyzer(config) }
