export const CALF_STATES = {
  IDLE: 'IDLE',
  DOWN: 'DOWN',
  RISING: 'RISING',
  RAISED: 'RAISED',
  LOWERING: 'LOWERING',
}

export const CALF_STATE_LABELS = {
  IDLE: 'Sin persona',
  DOWN: 'De pie',
  RISING: 'Subiendo',
  RAISED: 'Punta de los pies',
  LOWERING: 'Bajando',
}

export const DEFAULT_CALF_CONFIG = {
  riseRatio: 0.06,
  minRise: 0.012,
  downThreshold: 0.15,
  leaveRatio: 0.6,
  partialRatio: 0.5,
  minTopFrames: 3,
  minTopMs: 110,
  hysteresis: 0.004,
  minVisibility: 0.55,
  trackingTimeoutMs: 900,
}

const Y_SMOOTH_WINDOW = 3

export function createCalfRaiseAnalyzer(userConfig = {}) {
  const config = { ...DEFAULT_CALF_CONFIG, ...userConfig }

  let state = CALF_STATES.IDLE
  let repCount = 0
  let baselineY = null
  let topFrames = 0
  let topSince = null
  let cycleStart = null
  let lastTrackedAt = null
  let lastFeedback = ''
  let isRepetition = false
  let mainAngle = null
  const yHistory = []

  const setFeedback = (message) => {
    lastFeedback = message
  }

  const resetCycle = () => {
    topFrames = 0
    topSince = null
    cycleStart = null
  }

  const smoothY = (value) => {
    yHistory.push(value)
    if (yHistory.length > Y_SMOOTH_WINDOW) yHistory.shift()
    return yHistory.reduce((sum, item) => sum + item, 0) / yHistory.length
  }

  const requiredRise = (heightRef) => Math.max(config.minRise, config.riseRatio * (heightRef ?? 0))

  const goTo = (next) => {
    state = next
  }

  const reanchor = (y) => {
    baselineY = baselineY * 0.7 + y * 0.3
  }

  function update({ shoulderY, heightRef = 0, visibility = 1, timestamp = 0 }) {
    if (typeof shoulderY !== 'number' || Number.isNaN(shoulderY) || visibility < config.minVisibility) {
      const timedOut = lastTrackedAt !== null && timestamp - lastTrackedAt > config.trackingTimeoutMs
      if (timedOut || state === CALF_STATES.IDLE) {
        resetCycle()
        yHistory.length = 0
        baselineY = null
        goTo(CALF_STATES.IDLE)
        setFeedback('Colócate de frente, con todo el cuerpo visible')
      }
      return snapshot()
    }

    lastTrackedAt = timestamp
    const y = smoothY(shoulderY)
    if (baselineY === null) baselineY = y
    const required = requiredRise(heightRef)
    const residual = baselineY - y
    mainAngle = residual

    switch (state) {
      case CALF_STATES.IDLE:
        goTo(CALF_STATES.DOWN)
        resetCycle()
        baselineY = y
        setFeedback('Posición inicial')
        break

      case CALF_STATES.DOWN:
        if (y > baselineY) {
          baselineY = y
        } else if (residual < config.hysteresis) {
          reanchor(y)
        }
        if (baselineY - y >= required) {
          goTo(CALF_STATES.RISING)
          resetCycle()
          topSince = timestamp
          cycleStart = timestamp
          setFeedback('Sube sobre las puntas')
        } else {
          setFeedback('Posición inicial')
        }
        break

      case CALF_STATES.RISING:
        if (baselineY - y >= required) {
          topFrames += 1
          const stableFrames = topFrames >= config.minTopFrames
          const stableMs = topSince !== null && timestamp - topSince >= config.minTopMs
          if (stableFrames && stableMs) {
            goTo(CALF_STATES.RAISED)
            setFeedback('Punta de los pies')
          }
        } else {
          resetCycle()
          goTo(CALF_STATES.DOWN)
          setFeedback('Elevación más alta')
        }
        break

      case CALF_STATES.RAISED:
        topFrames += 1
        if (baselineY - y < required * config.leaveRatio) {
          const stableFrames = topFrames >= config.minTopFrames
          const stableMs = topSince !== null && timestamp - topSince >= config.minTopMs
          if (stableFrames && stableMs) {
            goTo(CALF_STATES.LOWERING)
            setFeedback('Baja a la posición inicial')
          } else {
            resetCycle()
            goTo(CALF_STATES.DOWN)
            setFeedback('Mantén la punta un momento')
          }
        } else {
          setFeedback('Punta de los pies')
        }
        break

      case CALF_STATES.LOWERING:
        if (baselineY - y < config.hysteresis) {
          reanchor(y)
        }
        if (baselineY - y <= required * config.downThreshold) {
          repCount += 1
          isRepetition = true
          setFeedback('Repetición válida')
          resetCycle()
          goTo(CALF_STATES.DOWN)
        } else if (baselineY - y >= required) {
          goTo(CALF_STATES.RAISED)
        }
        break

      default:
        goTo(CALF_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    const postureMap = {
      IDLE: 'IDLE',
      DOWN: 'UP',
      RISING: 'DOWN',
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
      stateLabel: CALF_STATE_LABELS[state] ?? 'Sin persona',
      baselineY,
      topFrames,
      cycleStart,
      lastTrackedAt,
    }
    isRepetition = false
    return snap
  }

  function reset() {
    resetCycle()
    yHistory.length = 0
    baselineY = null
    goTo(CALF_STATES.IDLE)
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

export const CALF_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftFootIndex: 31,
  rightFootIndex: 32,
}
