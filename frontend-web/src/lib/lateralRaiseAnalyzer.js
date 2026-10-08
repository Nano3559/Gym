// Analizador de elevaciones laterales de hombro en tiempo real.
//
// El ángulo se mide en el hombro (cadera -> hombro -> codo): ~15° con los
// brazos caídos es la posición inicial y ~80°-90° (brazos en "T") marca el
// punto medio de la repetición. Lógica pura y testeable de forma aislada.

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
  // Ángulo máximo para considerar los brazos caídos y "listo" para contar.
  downAngle: 30,
  // Umbral que inicia la elevación.
  raiseAngle: 35,
  // Ángulo mínimo (brazos en "T") para que la repetición cuente.
  topAngle: 78,
  // Estabilidad mínima en la posición alta (frames y/o milisegundos).
  minTopFrames: 3,
  minTopMs: 110,
  // Margen de histeresis para no alternar estados por ruido.
  hysteresis: 4,
  // Visibilidad mínima de los landmarks clave (MediaPipe 0..1).
  minVisibility: 0.55,
  // Si no hay pose válida durante este tiempo, se resetea el contador de ciclo.
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

  // Transición genérica: DOWN -> RAISING -> RAISED -> LOWERING -> DOWN
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

    switch (state) {
      case RAISE_STATES.IDLE:
        goTo(RAISE_STATES.DOWN)
        resetCycle()
        // Si aparece con los brazos caídos, queda listo para iniciar un ciclo.
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
          // Empieza la elevación: sólo cuenta si veníamos con los brazos abajo.
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
          // Se arrepintió antes de elevar: reinicia sin contar.
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
            // No llegó a la "T" o no se mantuvo: movimiento no válido.
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
            setFeedback('Repetición válida')
          }
          armed = true
          depthReached = false
          topFrames = 0
          topSince = null
          goTo(RAISE_STATES.DOWN)
        } else if (shoulderAngle >= config.topAngle) {
          // Volvió a subir sin completar el descenso: ciclo inválido.
          goTo(RAISE_STATES.RAISED)
        }
        break

      default:
        goTo(RAISE_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    return {
      state,
      stateLabel: RAISE_STATE_LABELS[state] ?? 'Sin persona',
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

// Extrae los puntos necesarios para las elevaciones desde los landmarks.
export const RAISE_LANDMARKS = {
  leftHip: 23,
  rightHip: 24,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
}