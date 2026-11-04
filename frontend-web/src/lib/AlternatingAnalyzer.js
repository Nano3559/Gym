import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
export class AlternatingAnalyzer extends CoordRepAnalyzer {
  processFrame(points, index, timestamp=0) {
    this.clearRepetitionFlag()
    if (!this.checkVisibility(points,this.config.requiredIndices)) { this.lastExtreme=null; return this.lostFrame() }
    const value=this.config.metric(points,this)
    if (!Number.isFinite(value)) return this.lostFrame()
    this.angle=this.smoothValue(value)
    const side=this.angle>=this.config.threshold ? 'left' : this.angle<=-this.config.threshold ? 'right' : null
    if(side && side!==this.lastExtreme) {
      if(this.lastExtreme && timestamp-(this.extremeAt ?? timestamp)>=this.config.minRepMs) {
        this.consumeRepetition(side); this.lastExtreme=side; this.extremeAt=timestamp
      } else if(!this.lastExtreme) { this.lastExtreme=side; this.extremeAt=timestamp }
    }
    this.postureState=side ? 'DOWN' : 'UP'
    this.setFeedback(this.isRepetition ? 'Repetición válida' : 'Alterna ambos lados')
    return this.snapshot()
  }
  reset() { super.reset(); this.lastExtreme=null; this.extremeAt=null }
}
