import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const BENCH_DIP_CONFIG = {
  upThreshold: 165,
  downThreshold: 90,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class BenchDipAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...BENCH_DIP_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createBenchDipAnalyzer(config = {}) {
  return new BenchDipAnalyzer(config)
}
