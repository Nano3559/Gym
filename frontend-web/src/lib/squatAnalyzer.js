export const SQUAT_STATES = {
  IDLE: 'IDLE',
  STANDING: 'STANDING',
  DESCENDING: 'DESCENDING',
  BOTTOM: 'BOTTOM',
  ASCENDING: 'ASCENDING',
}

export const STATE_LABELS = {
  IDLE: 'Sin persona',
  STANDING: 'De pie',
  DESCENDING: 'Bajando',
  BOTTOM: 'Posición baja',
  ASCENDING: 'Subiendo',
}

export const DEFAULT_SQUAT_CONFIG = {
  standingAngle: 158,
  descendAngle: 148,
  depthAngle: 102,
  riseAngle: 122,
  minBottomFrames: 3,
  minBottomMs: 110,
  hysteresis: 4,
  minVisibility: 0.55,
  trackingTimeoutMs: 900,
}

export function createSquatAnalyzer(userConfig = {}) {
  const config = { ...DEFAULT_SQUAT_CONFIG, ...userConfig }

  let state = SQUAT_STATES.IDLE
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

  function update({ kneeAngle, hip, knee, visibility = 1, timestamp = 0 }) {
    if (typeof kneeAngle !== 'number' || Number.isNaN(kneeAngle) || visibility < config.minVisibility) {
      const timedOut = lastTrackedAt !== null && timestamp - lastTrackedAt > config.trackingTimeoutMs
      if (timedOut || state === SQUAT_STATES.IDLE) {
        resetCycle()
        goTo(SQUAT_STATES.IDLE)
        setFeedback('Colócate de lado, de cuerpo entero')
      }
      return snapshot()
    }

    lastTrackedAt = timestamp
    mainAngle = kneeAngle
    const hipBelowKnee = Boolean(hip && knee && hip.y >= knee.y - 0.03)

    switch (state) {
      case SQUAT_STATES.IDLE:
        goTo(SQUAT_STATES.STANDING)
        resetCycle()
        if (kneeAngle >= config.standingAngle) {
          armed = true
          setFeedback('Posición inicial lista')
        }
        break

      case SQUAT_STATES.STANDING:
        if (kneeAngle >= config.standingAngle + config.hysteresis) {
          armed = true
          depthReached = false
          setFeedback('Posición inicial')
        } else if (kneeAngle < config.descendAngle) {
          if (armed) {
            goTo(SQUAT_STATES.DESCENDING)
            cycleStart = timestamp
            setFeedback('Baja')
          }
        }
        break

      case SQUAT_STATES.DESCENDING:
        if (kneeAngle <= config.depthAngle) {
          goTo(SQUAT_STATES.BOTTOM)
          depthReached = true
          bottomFrames = 0
          bottomSince = timestamp
          setFeedback(hipBelowKnee ? 'Buena sentadilla' : 'Baja un poco más')
        } else if (kneeAngle > config.standingAngle - config.hysteresis) {
          resetCycle()
          armed = true
          setFeedback('Posición inicial')
        }
        break

      case SQUAT_STATES.BOTTOM:
        bottomFrames += 1
        if (kneeAngle > config.riseAngle) {
          const stableFrames = bottomFrames >= config.minBottomFrames
          const stableMs = bottomSince !== null && timestamp - bottomSince >= config.minBottomMs
          if (depthReached && stableFrames && stableMs) {
            goTo(SQUAT_STATES.ASCENDING)
            setFeedback('Sube')
          } else {
            resetCycle()
            armed = true
            goTo(SQUAT_STATES.STANDING)
            setFeedback('Baja más abajo')
          }
        } else if (hipBelowKnee) {
          setFeedback('Buena sentadilla')
        }
        break

      case SQUAT_STATES.ASCENDING:
        if (kneeAngle >= config.standingAngle - config.hysteresis) {
          if (depthReached) {
            repCount += 1
            isRepetition = true
            setFeedback('Repetición válida')
          }
          armed = true
          depthReached = false
          bottomFrames = 0
          bottomSince = null
          goTo(SQUAT_STATES.STANDING)
        } else if (kneeAngle < config.depthAngle) {
          goTo(SQUAT_STATES.DESCENDING)
        }
        break

      default:
        goTo(SQUAT_STATES.IDLE)
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
      stateLabel: STATE_LABELS[state] ?? 'Sin persona',
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
    goTo(SQUAT_STATES.IDLE)
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

export const SQUAT_LANDMARKS = {
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
}
