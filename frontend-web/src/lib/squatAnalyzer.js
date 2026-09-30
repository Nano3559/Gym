// Analizador de sentadillas en tiempo real.
//
// Recibe únicamente datos de pose (ángulos y posiciones relativas) y decide
// en qué estado está la persona, si una repetición es válida y qué mensaje
// mostrar. No toca React ni el DOM: es lógica pura y testeable de forma aislada.

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
  // Umbral para considerar que la persona está erguida y "lista" para contar.
  standingAngle: 158,
  // Umbral que inicia el descenso.
  descendAngle: 148,
  // Profundidad mínima (ángulo de rodilla cerrado) para que la repetición cuente.
  depthAngle: 102,
  // Al subir de la zona baja, se considera que ya está en ascenso.
  riseAngle: 122,
  // Estabilidad mínima en la posición baja (frames y/o milisegundos).
  minBottomFrames: 3,
  minBottomMs: 110,
  // Margen de histeresis para no alternar estados por ruido.
  hysteresis: 4,
  // Visibilidad mínima de los_landmarks clave (MediaPipe 0..1).
  minVisibility: 0.55,
  // Si no hay pose válida durante este tiempo, se resetea el contador de ciclo.
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
    const hipBelowKnee = Boolean(hip && knee && hip.y >= knee.y - 0.03)

    switch (state) {
      case SQUAT_STATES.IDLE:
        goTo(SQUAT_STATES.STANDING)
        resetCycle()
        // Si la persona aparece ya de pie, queda lista para iniciar un ciclo.
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
          // Empieza el descenso: sólo cuenta si veníamos de pie.
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
          // Se.arrepintió antes de bajar: reinicia sin contar.
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
            // Bajó poco o no se mantuvo: movimiento no válido.
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
            setFeedback('Repetición válida')
          }
          armed = true
          depthReached = false
          bottomFrames = 0
          bottomSince = null
          goTo(SQUAT_STATES.STANDING)
        } else if (kneeAngle < config.depthAngle) {
          // Volvió a bajar sin completar el ascenso: sigue en ciclo inválido.
          goTo(SQUAT_STATES.DESCENDING)
        }
        break

      default:
        goTo(SQUAT_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    return {
      state,
      stateLabel: STATE_LABELS[state] ?? 'Sin persona',
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

// Extrae los puntos necesarios para sentadilla desde los landmarks de MediaPipe.
export const SQUAT_LANDMARKS = {
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
}
