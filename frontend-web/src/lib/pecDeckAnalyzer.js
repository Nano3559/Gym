import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { spread } from './poseMetrics.js'
export const PEC_DECK_CONFIG = {
  requiredIndices: [11,12,23,24,15,16], threshold: 0.7, resetOffset: 0.7, direction: 'decrease',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p) => spread(p,15,16),
}
export class PecDeckAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...PEC_DECK_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createPecDeckAnalyzer(config = {}) { return new PecDeckAnalyzer(config) }
