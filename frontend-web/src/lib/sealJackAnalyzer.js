import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { spread } from './poseMetrics.js'
export const SEAL_JACK_CONFIG = {
  requiredIndices: [11,12,23,24,15,16,27,28], threshold: 2, resetOffset: 1, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  minSpread: 1.4,
  metric: (p, a) => spread(p,27,28) > a.config.minSpread ? spread(p,15,16) : 0,
}
export class SealJackAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...SEAL_JACK_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createSealJackAnalyzer(config = {}) { return new SealJackAnalyzer(config) }
