import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const DIP_PARALLEL_CONFIG = {
  upThreshold: 165,
  downThreshold: 85,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class DipParallelAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...DIP_PARALLEL_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createDipParallelAnalyzer(config = {}) {
  return new DipParallelAnalyzer(config)
}
