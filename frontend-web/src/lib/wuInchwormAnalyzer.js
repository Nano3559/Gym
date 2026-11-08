import { SequenceAnalyzer } from './SequenceAnalyzer.js'
import { angleAt, horizontal } from './poseMetrics.js'
export const WU_INCHWORM_CONFIG = {
  requiredIndices: [11, 23, 25, 27], sequence: [0,1,0],
  minVisibility: 0.5, minPhaseMs: 90, minRepMs: 400, 
  phase: (p) => horizontal(p[11],p[23]) && angleAt(p[11],p[23],p[27])>160 ? 1 : angleAt(p[23],p[25],p[27])>160 && !horizontal(p[11],p[23]) ? 0 : null,
}
export class WuInchwormAnalyzer extends SequenceAnalyzer {
  constructor(config={}) { super({ ...WU_INCHWORM_CONFIG, ...config }) }
}
export function createWuInchwormAnalyzer(config={}) { return new WuInchwormAnalyzer(config) }
