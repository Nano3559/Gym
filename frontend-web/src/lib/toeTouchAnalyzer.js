import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { distance, bodyScale, sideIndex } from './poseMetrics.js'
export const TOE_TOUCH_CONFIG = {
  requiredIndices: [11, 12, 23, 24], requiredSideIndices: [15, 28], threshold: 0.4, resetOffset: 0.35, direction: 'decrease',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => distance(p[sideIndex(15,a)],p[sideIndex(28,a)])/bodyScale(p),
}
export class ToeTouchAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...TOE_TOUCH_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createToeTouchAnalyzer(config = {}) { return new ToeTouchAnalyzer(config) }
