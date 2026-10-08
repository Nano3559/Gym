export const RAISE_STATES = {
  IDLE: 'IDLE',
  DOWN: 'DOWN',
  RAISING: 'RAISING',
  RAISED: 'RAISED',
  LOWERING: 'LOWERING',
}

export const RAISE_STATE_LABELS = {
  IDLE: 'Sin persona',
  DOWN: 'Brazos abajo',
  RAISING: 'Subiendo',
  RAISED: 'Brazos en T',
  LOWERING: 'Bajando',
}

export const DEFAULT_RAISE_CONFIG = {
  downAngle: 30,
  raiseAngle: 35,
  topAngle: 78,
  minTopFrames: 3,
  minTopMs: 110,
  hysteresis: 4,
  minVisibility: 0.55,
  trackingTimeoutMs: 900,
}

export function createLateralRaiseAnalyzer(userConfig = {}) {
  const config = { ...DEFAULT_RAISE_CONFIG, ...userConfig }

  let state = RAISE_STATES.IDLE
  let repCount = 0
  let armed = false
  let depthReached = false
  let topFrames = 0
  let topSince = null
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
    topFrames = 0
    topSince = null
    cycleStart = null
  }

  const goTo = (next) => {
    state = next
  }

  function update({ shoulderAngle, visibility = 1, timestamp = 0 }) {
    if (typeof shoulderAngle !== 'number' || Number.isNaN(shoulderAngle) || visibility < config.minVisibility) {
      const timedOut = lastTrackedAt !== null && timestamp - lastTrackedAt > config.trackingTimeoutMs
      if (timedOut || state === RAISE_STATES.IDLE) {
        resetCycle()
        goTo(RAISE_STATES.IDLE)
        setFeedback('Colócate de frente a la cámara, con los brazos caídos')
      }
      return snapshot()
    }

    lastTrackedAt = timestamp
    mainAngle = shoulderAngle

    switch (state) {
      case RAISE_STATES.IDLE:
        goTo(RAISE_STATES.DOWN)
        resetCycle()
        if (shoulderAngle <= config.downAngle) {
          armed = true
          setFeedback('Posición inicial lista')
        }
        break

      case RAISE_STATES.DOWN:
        if (shoulderAngle <= config.downAngle - config.hysteresis) {
          armed = true
          depthReached = false
          setFeedback('Posición inicial')
        } else if (shoulderAngle > config.raiseAngle) {
          if (armed) {
            goTo(RAISE_STATES.RAISING)
            cycleStart = timestamp
            setFeedback('Sube los brazos')
          }
        }
        break

      case RAISE_STATES.RAISING:
        if (shoulderAngle >= config.topAngle) {
          goTo(RAISE_STATES.RAISED)
          depthReached = true
          topFrames = 0
          topSince = timestamp
          setFeedback(shoulderAngle >= config.topAngle + 4 ? 'Buena elevación' : 'Sube un poco más')
        } else if (shoulderAngle <= config.downAngle - config.hysteresis) {
          resetCycle()
          armed = true
          setFeedback('Posición inicial')
        }
        break

      case RAISE_STATES.RAISED:
        topFrames += 1
        if (shoulderAngle < config.topAngle - config.hysteresis) {
          const stableFrames = topFrames >= config.minTopFrames
          const stableMs = topSince !== null && timestamp - topSince >= config.minTopMs
          if (depthReached && stableFrames && stableMs) {
            goTo(RAISE_STATES.LOWERING)
            setFeedback('Baja los brazos')
          } else {
            resetCycle()
            armed = true
            goTo(RAISE_STATES.DOWN)
            setFeedback('Eleva más los brazos')
          }
        } else if (shoulderAngle >= config.topAngle + 4) {
          setFeedback('Buena elevación')
        } else {
          setFeedback('Sube un poco más')
        }
        break

      case RAISE_STATES.LOWERING:
        if (shoulderAngle <= config.downAngle) {
          if (depthReached) {
            repCount += 1
            isRepetition = true
            setFeedback('Repetición válida')
          }
          armed = true
          depthReached = false
          topFrames = 0
          topSince = null
          goTo(RAISE_STATES.DOWN)
        } else if (shoulderAngle >= config.topAngle) {
          goTo(RAISE_STATES.RAISED)
        }
        break

      default:
        goTo(RAISE_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    const postureMap = {
      IDLE: 'IDLE',
      DOWN: 'UP',
      RAISING: 'DOWN',
      RAISED: 'DOWN',
      LOWERING: 'UP',
    }
    const snap = {
      isRepetition,
      repCount,
      feedback: lastFeedback,
      angle: mainAngle,
      postureState: postureMap[state] || 'IDLE',
      state,
      stateLabel: RAISE_STATE_LABELS[state] ?? 'Sin persona',
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
    goTo(RAISE_STATES.IDLE)
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

export const RAISE_LANDMARKS = {
  leftHip: 23,
  rightHip: 24,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
}
