import { IsometricAnalyzer } from './IsometricAnalyzer.js'
import { distance, bodyScale, sideIndex, joint } from './poseMetrics.js'
export const ST_FIGURE4_CONFIG = {
  targetSeconds: 30, validMin: 1, validMax: 1, minVisibility: 0.5, smootherWindow: 1,
  requiredIndices: [11,12,23,24,25,26,27,28], 
  metric: (p,a) => (distance(p[sideIndex(27,a)],p[sideIndex(26,a)])/bodyScale(p)<0.4 && joint(p,11,23,25,a)<120) ? 1 : 0,
}
export class StFigure4Analyzer extends IsometricAnalyzer {
  constructor(config = {}) { super({ ...ST_FIGURE4_CONFIG, ...config }) }
  processFrame(landmarks,timestamp=0) { return super.processFrame(landmarks,11,23,27,timestamp) }
}
export function createStFigure4Analyzer(config={}) { return new StFigure4Analyzer(config) }
