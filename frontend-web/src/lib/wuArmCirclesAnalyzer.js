import { SequenceAnalyzer } from './SequenceAnalyzer.js'
import { bodyScale } from './poseMetrics.js'
export const WU_ARM_CIRCLES_CONFIG = {
  requiredIndices: [11,12,13,15,23,24], sequence: [0,1,2,3,0],
  allowReverse: true,
  minVisibility: 0.5, minPhaseMs: 90, minRepMs: 400, minRadius: 0.4,
  phase: (p, a) => (() => { const dx=p[15].x-p[11].x, dy=p[15].y-p[11].y;
 if(Math.hypot(dx,dy)/bodyScale(p)<a.config.minRadius) return null;
 return (Math.floor((Math.atan2(dy,dx)+Math.PI)/(Math.PI/2))+4)%4 })(),
}
export class WuArmCirclesAnalyzer extends SequenceAnalyzer {
  constructor(config={}) { super({ ...WU_ARM_CIRCLES_CONFIG, ...config }) }
}
export function createWuArmCirclesAnalyzer(config={}) { return new WuArmCirclesAnalyzer(config) }
