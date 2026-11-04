export const CURL_STATES = {
  IDLE: 'IDLE',
  EXTENDED: 'EXTENDED',
  FLEXING: 'FLEXING',
  FLEXED: 'FLEXED',
  EXTENDING: 'EXTENDING',
}

export const CURL_STATE_LABELS = {
  IDLE: 'Sin persona',
  EXTENDED: 'Brazo extendido',
  FLEXING: 'Flexionando',
  FLEXED: 'Contracción máxima',
  EXTENDING: 'Extendiendo',
}

export const DEFAULT_CURL_CONFIG = {
  extendedAngle: 158,
  flexAngle: 148,
  peakAngle: 35,
  extendAngle: 50,
  minPeakFrames: 3,
  minPeakMs: 110,
  hysteresis: 4,
  minVisibility: 0.55,
  trackingTimeoutMs: 900,
}

export function createCurlAnalyzer(userConfig = {}) {
  const config = { ...DEFAULT_CURL_CONFIG, ...userConfig }

  let state = CURL_STATES.IDLE
  let repCount = 0
  let armed = false
  let depthReached = false
  let peakFrames = 0
  let peakSince = null
  let cycleStart = null
  let lastTrackedAt = null
  let lastFeedback = ''
  let isRepetition = false
  let mainAngle = null

  const setFeedback = (message) => {
    lastFeedback = message
  }

  const resetCycle = () => {
    armed = false
    depthReached = false
    peakFrames = 0
    peakSince = null
    cycleStart = null
  }

  const goTo = (next) => {
    state = next
  }

  function update({ elbowAngle, visibility = 1, timestamp = 0 }) {
    if (typeof elbowAngle !== 'number' || Number.isNaN(elbowAngle) || visibility < config.minVisibility) {
      const timedOut = lastTrackedAt !== null && timestamp - lastTrackedAt > config.trackingTimeoutMs
      if (timedOut || state === CURL_STATES.IDLE) {
        resetCycle()
        goTo(CURL_STATES.IDLE)
        setFeedback('Colócate de lado, con el brazo en el aire')
      }
      return snapshot()
    }

    lastTrackedAt = timestamp
    mainAngle = elbowAngle

    switch (state) {
      case CURL_STATES.IDLE:
        goTo(CURL_STATES.EXTENDED)
        resetCycle()
        if (elbowAngle >= config.extendedAngle) {
          armed = true
          setFeedback('Posición inicial lista')
        }
        break

      case CURL_STATES.EXTENDED:
        if (elbowAngle >= config.extendedAngle + config.hysteresis) {
          armed = true
          depthReached = false
          setFeedback('Posición inicial')
        } else if (elbowAngle < config.flexAngle) {
          if (armed) {
            goTo(CURL_STATES.FLEXING)
            cycleStart = timestamp
            setFeedback('Flexiona el codo')
          }
        }
        break

      case CURL_STATES.FLEXING:
        if (elbowAngle <= config.peakAngle) {
          goTo(CURL_STATES.FLEXED)
          depthReached = true
          peakFrames = 0
          peakSince = timestamp
          setFeedback('Contracción completa')
        } else if (elbowAngle > config.extendedAngle - config.hysteresis) {
          resetCycle()
          armed = true
          setFeedback('Posición inicial')
        }
        break

      case CURL_STATES.FLEXED:
        peakFrames += 1
        if (elbowAngle > config.extendAngle) {
          const stableFrames = peakFrames >= config.minPeakFrames
          const stableMs = peakSince !== null && timestamp - peakSince >= config.minPeakMs
          if (depthReached && stableFrames && stableMs) {
            goTo(CURL_STATES.EXTENDING)
            setFeedback('Extiende el brazo')
          } else {
            resetCycle()
            armed = true
            goTo(CURL_STATES.EXTENDED)
            setFeedback('Flexiona más el codo')
          }
        } else {
          setFeedback('Contracción máxima')
        }
        break

      case CURL_STATES.EXTENDING:
        if (elbowAngle >= config.extendedAngle - config.hysteresis) {
          if (depthReached) {
            repCount += 1
            isRepetition = true
            setFeedback('Repetición válida')
          }
          armed = true
          depthReached = false
          peakFrames = 0
          peakSince = null
          goTo(CURL_STATES.EXTENDED)
        } else if (elbowAngle < config.peakAngle) {
          goTo(CURL_STATES.FLEXING)
        }
        break

      default:
        goTo(CURL_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    const postureMap = {
      IDLE: 'IDLE',
      EXTENDED: 'UP',
      FLEXING: 'DOWN',
      FLEXED: 'DOWN',
      EXTENDING: 'UP',
    }
    const snap = {
      isRepetition,
      repCount,
      feedback: lastFeedback,
      angle: mainAngle,
      postureState: postureMap[state] || 'IDLE',
      state,
      stateLabel: CURL_STATE_LABELS[state] ?? 'Sin persona',
      depthReached,
      armed,
      cycleStart,
      lastTrackedAt,
    }
    isRepetition = false
    return snap
  }

  function reset() {
    resetCycle()
    goTo(CURL_STATES.IDLE)
    repCount = 0
    lastTrackedAt = null
    setFeedback('')
  }

  function resetReps() {
    repCount = 0
    resetCycle()
  }

  return { update, snapshot, reset, resetReps, config }
}

export const CURL_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
}
