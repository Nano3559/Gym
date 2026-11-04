import { SequenceAnalyzer } from './SequenceAnalyzer.js'
import { midPoint, bodyScale } from './poseMetrics.js'
export const WU_HIP_CIRCLES_CONFIG = {
  requiredIndices: [11,12,23,24,27,28], sequence: [0,1,2,3,0],
  allowReverse: true,
  minVisibility: 0.5, minPhaseMs: 90, minRepMs: 400, minRadius: 0.08,
  phase: (p,a) => (() => { const hip=midPoint(p[23],p[24]); if(!a.center) a.center={...hip}; const dx=hip.x-a.center.x,dy=hip.y-a.center.y;
 if(Math.hypot(dx,dy)/bodyScale(p)<a.config.minRadius) return null;
 return (Math.floor((Math.atan2(dy,dx)+Math.PI)/(Math.PI/2))+4)%4 })(),
}
export class WuHipCirclesAnalyzer extends SequenceAnalyzer {
  constructor(config={}) { super({ ...WU_HIP_CIRCLES_CONFIG, ...config }) }
}
export function createWuHipCirclesAnalyzer(config={}) { return new WuHipCirclesAnalyzer(config) }
