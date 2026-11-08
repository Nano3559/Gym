import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { bodyScale } from './poseMetrics.js'
export const SUPERMAN_CONFIG = {
  requiredIndices: [11, 12, 23, 24, 15, 27], threshold: 0.15, resetOffset: 0.12, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 1000,
  metric: (p) => Math.min((p[11].y-p[15].y),(p[23].y-p[27].y))/bodyScale(p),
}
export class SupermanAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...SUPERMAN_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createSupermanAnalyzer(config = {}) { return new SupermanAnalyzer(config) }
