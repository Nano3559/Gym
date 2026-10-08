export const PUSHUP_STATES = {
  IDLE: 'IDLE',
  TOP: 'TOP',
  DESCENDING: 'DESCENDING',
  BOTTOM: 'BOTTOM',
  ASCENDING: 'ASCENDING',
}

export const PUSHUP_STATE_LABELS = {
  IDLE: 'Sin persona',
  TOP: 'Brazos extendidos',
  DESCENDING: 'Bajando',
  BOTTOM: 'Posición baja',
  ASCENDING: 'Subiendo',
}

export const DEFAULT_PUSHUP_CONFIG = {
  topAngle: 158,
  descendAngle: 148,
  depthAngle: 96,
  riseAngle: 118,
  minBodyAngle: 150,
  minBottomFrames: 3,
  minBottomMs: 110,
  hysteresis: 4,
  minVisibility: 0.55,
  trackingTimeoutMs: 900,
}

export function createPushupAnalyzer(userConfig = {}) {
  const config = { ...DEFAULT_PUSHUP_CONFIG, ...userConfig }

  let state = PUSHUP_STATES.IDLE
  let repCount = 0
  let armed = false
  let depthReached = false
  let bottomFrames = 0
  let bottomSince = null
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
    bottomFrames = 0
    bottomSince = null
    cycleStart = null
  }

  const goTo = (next) => {
    state = next
  }

  function update({ elbowAngle, bodyAngle, visibility = 1, timestamp = 0 }) {
    if (typeof elbowAngle !== 'number' || Number.isNaN(elbowAngle) || visibility < config.minVisibility) {
      const timedOut = lastTrackedAt !== null && timestamp - lastTrackedAt > config.trackingTimeoutMs
      if (timedOut || state === PUSHUP_STATES.IDLE) {
        resetCycle()
        goTo(PUSHUP_STATES.IDLE)
        setFeedback('Colócate de lado, con todo el cuerpo visible')
      }
      return snapshot()
    }

    lastTrackedAt = timestamp
    mainAngle = elbowAngle
    const bodyOk =
      typeof bodyAngle === 'number' && !Number.isNaN(bodyAngle) ? bodyAngle >= config.minBodyAngle : true

    switch (state) {
      case PUSHUP_STATES.IDLE:
        goTo(PUSHUP_STATES.TOP)
        resetCycle()
        if (elbowAngle >= config.topAngle) {
          armed = true
          setFeedback('Posición inicial lista')
        }
        break

      case PUSHUP_STATES.TOP:
        if (elbowAngle >= config.topAngle + config.hysteresis) {
          armed = true
          depthReached = false
          setFeedback('Posición inicial')
        } else if (elbowAngle < config.descendAngle) {
          if (armed) {
            goTo(PUSHUP_STATES.DESCENDING)
            cycleStart = timestamp
            setFeedback('Baja')
          }
        }
        break

      case PUSHUP_STATES.DESCENDING:
        if (elbowAngle <= config.depthAngle) {
          goTo(PUSHUP_STATES.BOTTOM)
          depthReached = true
          bottomFrames = 0
          bottomSince = timestamp
          setFeedback(bodyOk ? 'Buena flexión' : 'Cuerpo recto, sin cerrar las caderas')
        } else if (elbowAngle > config.topAngle - config.hysteresis) {
          resetCycle()
          armed = true
          setFeedback('Posición inicial')
        } else if (!bodyOk) {
          setFeedback('Mantén el cuerpo recto')
        }
        break

      case PUSHUP_STATES.BOTTOM:
        bottomFrames += 1
        if (elbowAngle > config.riseAngle) {
          const stableFrames = bottomFrames >= config.minBottomFrames
          const stableMs = bottomSince !== null && timestamp - bottomSince >= config.minBottomMs
          if (depthReached && bodyOk && stableFrames && stableMs) {
            goTo(PUSHUP_STATES.ASCENDING)
            setFeedback('Sube')
          } else {
            resetCycle()
            armed = true
            goTo(PUSHUP_STATES.TOP)
            setFeedback(bodyOk ? 'Baja más profundo' : 'Cuerpo recto, sin cerrar las caderas')
          }
        } else if (bodyOk) {
          setFeedback('Buena flexión')
        } else {
          setFeedback('Cuerpo recto, sin cerrar las caderas')
        }
        break

      case PUSHUP_STATES.ASCENDING:
        if (elbowAngle >= config.topAngle - config.hysteresis) {
          if (depthReached) {
            repCount += 1
            isRepetition = true
            setFeedback('Repetición válida')
          }
          armed = true
          depthReached = false
          bottomFrames = 0
          bottomSince = null
          goTo(PUSHUP_STATES.TOP)
        } else if (elbowAngle < config.depthAngle) {
          goTo(PUSHUP_STATES.DESCENDING)
        }
        break

      default:
        goTo(PUSHUP_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    const postureMap = {
      IDLE: 'IDLE',
      TOP: 'UP',
      DESCENDING: 'DOWN',
      BOTTOM: 'DOWN',
      ASCENDING: 'UP',
    }
    const snap = {
      isRepetition,
      repCount,
      feedback: lastFeedback,
      angle: mainAngle,
      postureState: postureMap[state] || 'IDLE',
      state,
      stateLabel: PUSHUP_STATE_LABELS[state] ?? 'Sin persona',
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
    goTo(PUSHUP_STATES.IDLE)
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

export const PUSHUP_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftAnkle: 27,
  rightAnkle: 28,
}
