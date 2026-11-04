import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
import { distance } from './poseMetrics.js'
export const CRUNCH_CONFIG = {
  requiredIndices: [11,12,23,24,25,26], threshold: 0.75, resetOffset: 0.15, direction: 'decrease',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => (() => { const d=distance(p[11],p[23]); if(a.baselineDistance == null) a.baselineDistance=d; return d/Math.max(a.baselineDistance,0.05) })(),
}
export class CrunchAnalyzer extends CoordRepAnalyzer {
  constructor(config = {}) { super({ ...CRUNCH_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createCrunchAnalyzer(config = {}) { return new CrunchAnalyzer(config) }
