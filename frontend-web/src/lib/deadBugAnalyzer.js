import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { angleAt, sideIndex, joint } from './poseMetrics.js'
export const DEAD_BUG_CONFIG = {
  requiredIndices: [11,12,23,24,15,16,25,26,27,28], threshold: 160, resetOffset: 40, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => Math.min(joint(p,15,11,23,a), angleAt(p[sideIndex(24,a)],p[sideIndex(26,a)],p[sideIndex(28,a)])),
}
export class DeadBugAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...DEAD_BUG_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createDeadBugAnalyzer(config = {}) { return new DeadBugAnalyzer(config) }
