// Analizador de zancadas (lunges) en tiempo real.
//
// Usa los mismos puntos que la sentadilla (cadera, rodilla, tobillo) pero mide
// la pierna delantera y la trasera de forma independiente. Una repetición es
// válida cuando la rodilla delantera llega a ~90° mientras la rodilla trasera
// baja (se dobla y queda por debajo de la delantera). Es lógica pura y
// testeable de forma aislada.

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
  // Umbral para considerar ambas piernas estiradas y quedar "listo" para contar.
  standingAngle: 155,
  // Umbral (rodilla delantera) que inicia el descenso.
  descendAngle: 145,
  // Flexión mínima de la rodilla delantera (~90°) para la repetición.
  frontDepthAngle: 118,
  // Al subir de la zona baja, se considera que ya está en ascenso.
  riseAngle: 138,
  // La rodilla trasera debe quedar visiblemente flexionada (descendida).
  backFlexAngle: 150,
  // Cuánto debe quedar la rodilla trasera POR DEBAJO de la delantera (unidades
  // normalizadas) para distinguir la zancada de una sentadilla.
  backDrop: 0.05,
  // Estabilidad mínima en la posición baja (frames y/o milisegundos).
  minBottomFrames: 3,
  minBottomMs: 110,
  // Margen de histeresis para no alternar estados por ruido.
  hysteresis: 4,
  // Visibilidad mínima de los landmarks clave (MediaPipe 0..1).
  minVisibility: 0.55,
  // Si no hay pose válida durante este tiempo, se resetea el contador de ciclo.
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

  // Transición genérica: STANDING -> DESCENDING -> BOTTOM -> ASCENDING -> STANDING
  const goTo = (next) => {
    state = next
  }

  const bothExtended = (front, back) =>
    typeof back === 'number' &&
    front >= config.standingAngle - config.hysteresis &&
    back >= config.standingAngle - config.hysteresis

  // Forma de zancada: la rodilla trasera doblada y por debajo de la delantera.
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

    switch (state) {
      case LUNGE_STATES.IDLE:
        goTo(LUNGE_STATES.STANDING)
        resetCycle()
        // Si la persona aparece ya de pie, queda lista para iniciar un ciclo.
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
          // Empieza el descenso: sólo cuenta si veníamos de pie.
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
          // Se arrepintió antes de bajar: reinicia sin contar.
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
            // Bajó poco, no se mantuvo o no completó la zancada: no es válida.
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
            setFeedback('Repetición válida')
          }
          armed = true
          depthReached = false
          bottomFrames = 0
          bottomSince = null
          goTo(LUNGE_STATES.STANDING)
        } else if (frontKneeAngle <= config.frontDepthAngle) {
          // Volvió a bajar sin completar el ascenso: sigue en ciclo inválido.
          goTo(LUNGE_STATES.DESCENDING)
        }
        break

      default:
        goTo(LUNGE_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    return {
      state,
      stateLabel: LUNGE_STATE_LABELS[state] ?? 'Sin persona',
      repCount,
      feedback: lastFeedback,
      depthReached,
      armed,
      cycleStart,
      lastTrackedAt,
    }
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

// Extrae los puntos necesarios para zancadas desde los landmarks de MediaPipe.
export const LUNGE_LANDMARKS = {
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
}