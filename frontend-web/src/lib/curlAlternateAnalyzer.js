import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const CURL_ALTERNATE_CONFIG = {
  upThreshold: 160,
  downThreshold: 30,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class CurlAlternateAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...CURL_ALTERNATE_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 13, 15, timestamp)
  }
}

export function createCurlAlternateAnalyzer(config = {}) {
  return new CurlAlternateAnalyzer(config)
}
