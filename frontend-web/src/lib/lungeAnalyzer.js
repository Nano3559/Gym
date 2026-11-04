export const LUNGE_STATES = {
  IDLE: 'IDLE',
  STANDING: 'STANDING',
  DESCENDING: 'DESCENDING',
  BOTTOM: 'BOTTOM',
  ASCENDING: 'ASCENDING',
}

export const LUNGE_STATE_LABELS = {
  IDLE: 'Sin persona',
  STANDING: 'De pie',
  DESCENDING: 'Bajando',
  BOTTOM: 'Posición de zancada',
  ASCENDING: 'Subiendo',
}

export const DEFAULT_LUNGE_CONFIG = {
  standingAngle: 155,
  descendAngle: 145,
  frontDepthAngle: 118,
  riseAngle: 138,
  backFlexAngle: 150,
  backDrop: 0.05,
  minBottomFrames: 3,
  minBottomMs: 110,
  hysteresis: 4,
  minVisibility: 0.55,
  trackingTimeoutMs: 900,
}

export function createLungeAnalyzer(userConfig = {}) {
  const config = { ...DEFAULT_LUNGE_CONFIG, ...userConfig }

  let state = LUNGE_STATES.IDLE
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

  const bothExtended = (front, back) =>
    typeof back === 'number' &&
    front >= config.standingAngle - config.hysteresis &&
    back >= config.standingAngle - config.hysteresis

  const shapeOk = (frontY, backY, backAngle) => {
    const backBent = typeof backAngle === 'number' && backAngle <= config.backFlexAngle
    const backLower =
      typeof frontY === 'number' && typeof backY === 'number' ? backY >= frontY + config.backDrop : true
    return backBent && backLower
  }

  function update({ frontKneeAngle, backKneeAngle, frontKneeY = null, backKneeY = null, visibility = 1, timestamp = 0 }) {
    if (typeof frontKneeAngle !== 'number' || Number.isNaN(frontKneeAngle) || visibility < config.minVisibility) {
      const timedOut = lastTrackedAt !== null && timestamp - lastTrackedAt > config.trackingTimeoutMs
      if (timedOut || state === LUNGE_STATES.IDLE) {
        resetCycle()
        goTo(LUNGE_STATES.IDLE)
        setFeedback('Colócate de lado, con todo el cuerpo visible')
      }
      return snapshot()
    }

    lastTrackedAt = timestamp
    mainAngle = frontKneeAngle

    switch (state) {
      case LUNGE_STATES.IDLE:
        goTo(LUNGE_STATES.STANDING)
        resetCycle()
        if (bothExtended(frontKneeAngle, backKneeAngle)) {
          armed = true
          setFeedback('Posición inicial lista')
        }
        break

      case LUNGE_STATES.STANDING:
        if (bothExtended(frontKneeAngle, backKneeAngle)) {
          armed = true
          depthReached = false
          setFeedback('Posición inicial')
        } else if (frontKneeAngle < config.descendAngle) {
          if (armed) {
            goTo(LUNGE_STATES.DESCENDING)
            cycleStart = timestamp
            setFeedback('Da un paso y baja')
          }
        }
        break

      case LUNGE_STATES.DESCENDING:
        if (frontKneeAngle <= config.frontDepthAngle) {
          goTo(LUNGE_STATES.BOTTOM)
          depthReached = true
          bottomFrames = 0
          bottomSince = timestamp
          setFeedback(shapeOk(frontKneeY, backKneeY, backKneeAngle) ? 'Buena zancada' : 'Baja la rodilla trasera')
        } else if (frontKneeAngle > config.standingAngle - config.hysteresis) {
          resetCycle()
          armed = true
          setFeedback('Posición inicial')
        } else if (!shapeOk(frontKneeY, backKneeY, backKneeAngle)) {
          setFeedback('Baja la rodilla trasera')
        }
        break

      case LUNGE_STATES.BOTTOM:
        bottomFrames += 1
        if (frontKneeAngle > config.riseAngle) {
          const stableFrames = bottomFrames >= config.minBottomFrames
          const stableMs = bottomSince !== null && timestamp - bottomSince >= config.minBottomMs
          if (depthReached && shapeOk(frontKneeY, backKneeY, backKneeAngle) && stableFrames && stableMs) {
            goTo(LUNGE_STATES.ASCENDING)
            setFeedback('Sube')
          } else {
            resetCycle()
            armed = true
            goTo(LUNGE_STATES.STANDING)
            setFeedback(shapeOk(frontKneeY, backKneeY, backKneeAngle) ? 'Baja más profundo' : 'Baja la rodilla trasera')
          }
        } else if (shapeOk(frontKneeY, backKneeY, backKneeAngle)) {
          setFeedback('Buena zancada')
        } else {
          setFeedback('Baja la rodilla trasera')
        }
        break

      case LUNGE_STATES.ASCENDING:
        if (bothExtended(frontKneeAngle, backKneeAngle)) {
          if (depthReached) {
            repCount += 1
            isRepetition = true
            setFeedback('Repetición válida')
          }
          armed = true
          depthReached = false
          bottomFrames = 0
          bottomSince = null
          goTo(LUNGE_STATES.STANDING)
        } else if (frontKneeAngle <= config.frontDepthAngle) {
          goTo(LUNGE_STATES.DESCENDING)
        }
        break

      default:
        goTo(LUNGE_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    const postureMap = {
      IDLE: 'IDLE',
      STANDING: 'UP',
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
      stateLabel: LUNGE_STATE_LABELS[state] ?? 'Sin persona',
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
    goTo(LUNGE_STATES.IDLE)
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

export const LUNGE_LANDMARKS = {
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
}
