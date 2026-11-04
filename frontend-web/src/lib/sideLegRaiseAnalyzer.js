import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { tilt, sideIndex } from './poseMetrics.js'
export const SIDE_LEG_RAISE_CONFIG = {
  requiredIndices: [11,12,23,24,27,28], threshold: 40, resetOffset: 30, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => tilt(p[sideIndex(23,a)],p[sideIndex(27,a)]),
}
export class SideLegRaiseAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...SIDE_LEG_RAISE_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createSideLegRaiseAnalyzer(config = {}) { return new SideLegRaiseAnalyzer(config) }
