import { SequenceAnalyzer } from './SequenceAnalyzer.js'
import { angleAt, midPoint, bodyScale, horizontal } from './poseMetrics.js'
export const BURPEE_CONFIG = {
  requiredIndices: [11, 12, 23, 24, 25, 27], sequence: [0,1,2,0],
  minVisibility: 0.5, minPhaseMs: 90, minRepMs: 400, jumpHeight: 0.08,
  phase: (p,a) => (() => { const hip=midPoint(p[23],p[24]); if(!a.center) a.center={...hip};
  if(horizontal(p[11],p[23]) && angleAt(p[11],p[23],p[27])>155) return 1;
  if(angleAt(p[23],p[25],p[27])>160 && !horizontal(p[11],p[23])) return a.center.y-hip.y>bodyScale(p)*a.config.jumpHeight ? 2 : 0;
  return null })(),
}
export class BurpeeAnalyzer extends SequenceAnalyzer {
  constructor(config={}) { super({ ...BURPEE_CONFIG, ...config }) }
}
export function createBurpeeAnalyzer(config={}) { return new BurpeeAnalyzer(config) }
