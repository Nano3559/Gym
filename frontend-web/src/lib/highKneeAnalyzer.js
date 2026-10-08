export const HIGH_KNEE_STATES = {
  IDLE: 'IDLE',
  LOW: 'LOW',
  UP: 'UP',
}

export const HIGH_KNEE_STATE_LABELS = {
  IDLE: 'Sin persona',
  LOW: 'Rodillas abajo',
  UP: 'Rodilla arriba',
}

export const DEFAULT_HIGH_KNEE_CONFIG = {
  upMargin: 0.005,
  resetMargin: 0.02,
  minVisibility: 0.55,
  trackingTimeoutMs: 900,
}

export function createHighKneeAnalyzer(userConfig = {}) {
  const config = { ...DEFAULT_HIGH_KNEE_CONFIG, ...userConfig }

  let state = HIGH_KNEE_STATES.IDLE
  let repCount = 0
  let liftedLeft = false
  let liftedRight = false
  let lastTrackedAt = null
  let lastFeedback = ''
  let isRepetition = false
  let mainAngle = null

  const setFeedback = (message) => {
    lastFeedback = message
  }

  const goTo = (next) => {
    state = next
  }

  function update({ leftKneeY, rightKneeY, leftHipY, rightHipY, visibility = 1, timestamp = 0 }) {
    if (
      typeof leftKneeY !== 'number' ||
      Number.isNaN(leftKneeY) ||
      typeof rightKneeY !== 'number' ||
      Number.isNaN(rightKneeY) ||
      typeof leftHipY !== 'number' ||
      Number.isNaN(leftHipY) ||
      typeof rightHipY !== 'number' ||
      Number.isNaN(rightHipY) ||
      visibility < config.minVisibility
    ) {
      const timedOut = lastTrackedAt !== null && timestamp - lastTrackedAt > config.trackingTimeoutMs
      if (timedOut || state === HIGH_KNEE_STATES.IDLE) {
        liftedLeft = false
        liftedRight = false
        goTo(HIGH_KNEE_STATES.IDLE)
        setFeedback('Colócate de frente, con el cuerpo entero visible')
      }
      return snapshot()
    }

    lastTrackedAt = timestamp
    const leftUp = leftKneeY <= leftHipY + config.upMargin
    const rightUp = rightKneeY <= rightHipY + config.upMargin
    mainAngle = Math.min(leftKneeY, rightKneeY)

    let counted = false
    if (leftUp && !liftedLeft) {
      liftedLeft = true
      repCount += 1
      isRepetition = true
      counted = true
    }
    if (rightUp && !liftedRight) {
      liftedRight = true
      repCount += 1
      isRepetition = true
      counted = true
    }
    if (!leftUp && liftedLeft && leftKneeY > leftHipY + config.resetMargin) {
      liftedLeft = false
    }
    if (!rightUp && liftedRight && rightKneeY > rightHipY + config.resetMargin) {
      liftedRight = false
    }

    if (counted) {
      goTo(HIGH_KNEE_STATES.UP)
      setFeedback('Repetición válida')
    } else if (leftUp || rightUp) {
      goTo(HIGH_KNEE_STATES.UP)
      setFeedback('Rodilla arriba')
    } else {
      goTo(HIGH_KNEE_STATES.LOW)
      setFeedback('Posición inicial')
    }

    return snapshot()
  }

  function snapshot() {
    const postureMap = {
      IDLE: 'IDLE',
      LOW: 'UP',
      UP: 'DOWN',
    }
    const snap = {
      isRepetition,
      repCount,
      feedback: lastFeedback,
      angle: mainAngle,
      postureState: postureMap[state] || 'IDLE',
      state,
      stateLabel: HIGH_KNEE_STATE_LABELS[state] ?? 'Sin persona',
      liftedLeft,
      liftedRight,
      lastTrackedAt,
    }
    isRepetition = false
    return snap
  }

  function reset() {
    liftedLeft = false
    liftedRight = false
    goTo(HIGH_KNEE_STATES.IDLE)
    repCount = 0
    lastTrackedAt = null
    setFeedback('')
  }

  function resetReps() {
    repCount = 0
  }

  return { update, snapshot, reset, resetReps, config }
}

export const HIGH_KNEE_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
}
