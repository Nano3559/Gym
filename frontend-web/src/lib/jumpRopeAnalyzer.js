import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { midPoint, bodyScale } from './poseMetrics.js'
export const JUMP_ROPE_CONFIG = {
  requiredIndices: [11,12,23,24,27,28], threshold: 0.08, resetOffset: 0.05, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => (() => { const y=midPoint(p[23],p[24]).y; if(a.baselineY == null) a.baselineY=y; return (a.baselineY-y)/bodyScale(p) })(),
}
export class JumpRopeAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...JUMP_ROPE_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createJumpRopeAnalyzer(config = {}) { return new JumpRopeAnalyzer(config) }
