export const JACK_STATES = {
  IDLE: 'IDLE',
  READY: 'READY',
  JUMPING: 'JUMPING',
  UP: 'UP',
  RETURNING: 'RETURNING',
}

export const JACK_STATE_LABELS = {
  IDLE: 'Sin persona',
  READY: 'De pie, pies juntos',
  JUMPING: 'Saltando',
  UP: 'Pies abiertos, brazos arriba',
  RETURNING: 'Volviendo',
}

export const DEFAULT_JACK_CONFIG = {
  spreadDeg: 45,
  readyDeg: 24,
  wristsUpMargin: 0.03,
  minTopFrames: 2,
  minTopMs: 80,
  minVisibility: 0.55,
  trackingTimeoutMs: 900,
}

export function createJackAnalyzer(userConfig = {}) {
  const config = { ...DEFAULT_JACK_CONFIG, ...userConfig }

  let state = JACK_STATES.IDLE
  let repCount = 0
  let armed = false
  let topReached = false
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
    topReached = false
    topFrames = 0
    topSince = null
    cycleStart = null
  }

  const goTo = (next) => {
    state = next
  }

  function update({ spreadAngle, headY, wristLeftY, wristRightY, visibility = 1, timestamp = 0 }) {
    if (
      typeof spreadAngle !== 'number' ||
      Number.isNaN(spreadAngle) ||
      typeof headY !== 'number' ||
      Number.isNaN(headY) ||
      visibility < config.minVisibility
    ) {
      const timedOut = lastTrackedAt !== null && timestamp - lastTrackedAt > config.trackingTimeoutMs
      if (timedOut || state === JACK_STATES.IDLE) {
        resetCycle()
        goTo(JACK_STATES.IDLE)
        setFeedback('Colócate de frente, con el cuerpo entero visible')
      }
      return snapshot()
    }

    lastTrackedAt = timestamp
    mainAngle = spreadAngle
    const wristsUp =
      typeof wristLeftY === 'number' &&
      typeof wristRightY === 'number' &&
      wristLeftY <= headY + config.wristsUpMargin &&
      wristRightY <= headY + config.wristsUpMargin
    const topConditions = spreadAngle >= config.spreadDeg && wristsUp
    const readyConditions = spreadAngle <= config.readyDeg

    switch (state) {
      case JACK_STATES.IDLE:
        goTo(JACK_STATES.READY)
        resetCycle()
        if (readyConditions) {
          armed = true
          setFeedback('Posición inicial lista')
        }
        break

      case JACK_STATES.READY:
        if (readyConditions) {
          armed = true
          topReached = false
          setFeedback('Posición inicial')
        } else if (topConditions) {
          if (armed) {
            goTo(JACK_STATES.JUMPING)
            topFrames = 0
            topSince = timestamp
            cycleStart = timestamp
            setFeedback('Abre piernas y brazos')
          }
        }
        break

      case JACK_STATES.JUMPING:
        topFrames += 1
        if (topConditions) {
          const stableFrames = topFrames >= config.minTopFrames
          const stableMs = topSince !== null && timestamp - topSince >= config.minTopMs
          if (stableFrames && stableMs) {
            goTo(JACK_STATES.UP)
            topReached = true
            setFeedback('Pies abiertos, brazos arriba')
          }
        } else {
          resetCycle()
          armed = true
          setFeedback('Posición inicial')
        }
        break

      case JACK_STATES.UP:
        topFrames += 1
        if (!topConditions) {
          const stableFrames = topFrames >= config.minTopFrames
          const stableMs = topSince !== null && timestamp - topSince >= config.minTopMs
          if (topReached && stableFrames && stableMs) {
            goTo(JACK_STATES.RETURNING)
            setFeedback('Junta los pies')
          } else {
            resetCycle()
            armed = true
            goTo(JACK_STATES.READY)
            setFeedback('Haz el salto completo')
          }
        }
        break

      case JACK_STATES.RETURNING:
        if (readyConditions) {
          if (topReached) {
            repCount += 1
            isRepetition = true
            setFeedback('Repetición válida')
          }
          armed = true
          topReached = false
          topFrames = 0
          topSince = null
          goTo(JACK_STATES.READY)
        } else if (topConditions) {
          goTo(JACK_STATES.UP)
        }
        break

      default:
        goTo(JACK_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    const postureMap = {
      IDLE: 'IDLE',
      READY: 'UP',
      JUMPING: 'DOWN',
      UP: 'DOWN',
      RETURNING: 'UP',
    }
    const snap = {
      isRepetition,
      repCount,
      feedback: lastFeedback,
      angle: mainAngle,
      postureState: postureMap[state] || 'IDLE',
      state,
      stateLabel: JACK_STATE_LABELS[state] ?? 'Sin persona',
      topReached,
      armed,
      cycleStart,
      lastTrackedAt,
    }
    isRepetition = false
    return snap
  }

  function reset() {
    resetCycle()
    goTo(JACK_STATES.IDLE)
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

export const JACK_LANDMARKS = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftAnkle: 27,
  rightAnkle: 28,
}
