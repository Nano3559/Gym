import { SequenceAnalyzer } from './SequenceAnalyzer.js'
import { angleAt, bodyScale, midPoint } from './poseMetrics.js'
export const SQUAT_JUMP_CONFIG = {
  requiredIndices: [11, 12, 23, 24, 25, 27], sequence:[0,1,2,0],
  minVisibility:0.5, minPhaseMs:40, minRepMs:400, standingAngle:165, depthAngle:95, jumpHeight:0.08,
  phase:(p,a)=>{
    const hip=midPoint(p[23],p[24]), knee=angleAt(p[23],p[25],p[27])
    if(a.center==null) a.center={...hip}
    if(knee<a.config.depthAngle) return 1
    if(knee>=a.config.standingAngle) return (a.center.y-hip.y)/bodyScale(p)>a.config.jumpHeight ? 2 : 0
    return null
  },
}
export class SquatJumpAnalyzer extends SequenceAnalyzer {
  constructor(config={}) { super({...SQUAT_JUMP_CONFIG,...config}) }
}
export function createSquatJumpAnalyzer(config={}) { return new SquatJumpAnalyzer(config) }
