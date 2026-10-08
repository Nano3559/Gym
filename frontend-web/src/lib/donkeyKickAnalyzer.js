import { AngleRepAnalyzer } from './AngleRepAnalyzer.js'

export const DONKEY_KICK_CONFIG = {
  upThreshold: 90,
  downThreshold: 170,
  hysteresis: 5,
  direction: 'increase',
  minTopMs: 100,
  minVisibility: 0.5,
  smootherWindow: 3,
  minRepMs: 400,
  trackingTimeoutMs: 900,
}

export class DonkeyKickAnalyzer extends AngleRepAnalyzer {
  constructor(config = {}) {
    super({ ...DONKEY_KICK_CONFIG, ...config })
  }

  processFrame(landmarks, timestamp = 0) {
    return super.processFrame(landmarks, 11, 23, 25, timestamp)
  }
}

export function createDonkeyKickAnalyzer(config = {}) {
  return new DonkeyKickAnalyzer(config)
}
