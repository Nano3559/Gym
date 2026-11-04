import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { spread } from './poseMetrics.js'
export const HIP_ABDUCTION_CONFIG = {
  requiredIndices: [11,12,23,24,27,28], threshold: 1.6, resetOffset: 0.7, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p) => spread(p,27,28),
}
export class HipAbductionAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...HIP_ABDUCTION_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createHipAbductionAnalyzer(config = {}) { return new HipAbductionAnalyzer(config) }
