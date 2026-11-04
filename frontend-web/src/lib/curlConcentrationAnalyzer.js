import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const CURL_CONCENTRATION_CONFIG = {
  upThreshold: 150,
  downThreshold: 35,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class CurlConcentrationAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...CURL_CONCENTRATION_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createCurlConcentrationAnalyzer(config = {}) {
  return new CurlConcentrationAnalyzer(config)
}
