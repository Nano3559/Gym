import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { distance, bodyScale, horizontal, sideIndex } from './poseMetrics.js'
export const MOUNTAIN_CLIMBER_CONFIG = {
  requiredIndices: [11,12,23,24,25,26], threshold: 0.5, resetOffset: 0.25, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => horizontal(p[11],p[23]) ? (distance(p[23],p[11])-distance(p[sideIndex(25,a)],p[11])) / bodyScale(p) : 0,
}
export class MountainClimberAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...MOUNTAIN_CLIMBER_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createMountainClimberAnalyzer(config = {}) { return new MountainClimberAnalyzer(config) }
