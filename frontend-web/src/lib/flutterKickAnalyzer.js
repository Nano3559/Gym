import { AlternatingAnalyzer } from './AlternatingAnalyzer.js'
import { bodyScale, sideIndex } from './poseMetrics.js'
export const FLUTTER_KICK_CONFIG = {
  requiredIndices: [11,12,23,24,27,28], threshold: 0.15, resetOffset: 0.25, direction: 'increase',
  minVisibility: 0.5, smootherWindow: 3, minRepMs: 400,
  
  metric: (p, a) => (p[sideIndex(28,a)].y-p[sideIndex(27,a)].y)/bodyScale(p),
}
export class FlutterKickAnalyzer extends AlternatingAnalyzer {
  constructor(config = {}) { super({ ...FLUTTER_KICK_CONFIG, ...config }) }
  processFrame(landmarks, timestamp = 0) { return super.processFrame(landmarks, 0, timestamp) }
}
export function createFlutterKickAnalyzer(config = {}) { return new FlutterKickAnalyzer(config) }
