import { CoordRepAnalyzer } from './CoordRepAnalyzer.js'
export class SequenceAnalyzer extends CoordRepAnalyzer {
  constructor(config) { super(config); this.resetSequence() }
  resetSequence() { this.step = 0; this.phaseSince = null; this.lastPhase = null; this.startedAt = null; this.sequence = null }
  processFrame(points,timestamp=0) {
    this.clearRepetitionFlag()
    if (!this.checkVisibility(points,this.config.requiredIndices)) { this.resetSequence(); return this.lostFrame() }
    const phase = this.config.phase(points,this)
    this.angle = Number.isFinite(phase) ? phase : 0
    if (phase !== this.lastPhase) { this.lastPhase = phase; this.phaseSince = timestamp }
    if (phase === null || timestamp-this.phaseSince < this.config.minPhaseMs) return this.snapshot()
    if(this.step===1 && this.config.allowReverse && phase===this.config.sequence.at(-2)) this.sequence=[...this.config.sequence].reverse()
    const sequence = this.sequence ?? this.config.sequence
    if (phase === sequence[this.step]) {
      if (!this.step) this.startedAt = timestamp
      this.step++
      if (this.step === sequence.length) {
        if (timestamp-this.startedAt >= this.config.minRepMs) this.consumeRepetition()
        this.step=1; this.startedAt=timestamp
      }
    } else if (phase === sequence[0] && this.step > 1) { this.step=1; this.startedAt=timestamp }
    this.postureState = this.step > 1 ? 'DOWN' : 'UP'
    this.setFeedback(this.isRepetition ? 'Repetición válida' : 'Completa la secuencia de movimiento')
    return this.snapshot()
  }
  reset() { super.reset(); this.resetSequence(); this.center = null }
}
