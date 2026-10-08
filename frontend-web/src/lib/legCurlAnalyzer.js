import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const LEG_CURL_CONFIG = {
  upThreshold: 170,
  downThreshold: 50,
  hysteresis: 5,
  direction: 'decrease',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class LegCurlAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...LEG_CURL_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 23, 25, 27, timestamp)
  }
}

export function createLegCurlAnalyzer(config = {}) {
  return new LegCurlAnalyzer(config)
}
