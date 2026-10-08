// Analizador de rodillas arriba (high knees) en tiempo real.
//
// Compara ejes verticales: cada pierna cuenta una repetición cuando su rodilla
// alcanza (o supera) la altura de la cadera del mismo lado. Para evitar contar
// de más, una pierna debe volver a bajar claramente antes de volver a contar.
// Lógica pura y testeable de forma aislada.

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
  // Margen fino hacia abajo de la cadera para detectar la elevación (la
  // rodilla debe quedar a la altura de la cadera o por encima).
  upMargin: 0.005,
  // La rodilla debe bajar claramente por debajo de la cadera antes de poder
  // volver a contar (histéresis para evitar dobles cuentas por ruido).
  resetMargin: 0.02,
  // Visibilidad mínima de los landmarks clave (MediaPipe 0..1).
  minVisibility: 0.55,
  // Si no hay pose válida durante este tiempo, se resetea el contador de ciclo.
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

    let counted = false
    // Cada pierna cuenta una repetición cuando su rodilla alcanza la cadera.
    if (leftUp && !liftedLeft) {
      liftedLeft = true
      repCount += 1
      counted = true
    }
    if (rightUp && !liftedRight) {
      liftedRight = true
      repCount += 1
      counted = true
    }
    // La pierna vuelve a armarse sólo cuando baja claramente de la cadera.
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
    return {
      state,
      stateLabel: HIGH_KNEE_STATE_LABELS[state] ?? 'Sin persona',
      repCount,
      feedback: lastFeedback,
      liftedLeft,
      liftedRight,
      lastTrackedAt,
    }
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

// Extrae los puntos necesarios para rodillas arriba desde los landmarks de
// MediaPipe: cadera y rodilla de cada pierna, más el hombro (sólo para mostrar
// el ángulo de cadera como métrica).
export const HIGH_KNEE_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
}