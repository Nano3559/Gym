// Analizador de flexiones en tiempo real.
//
// Sigue el mismo esquema que el analizador de sentadillas: recibe únicamente
// datos de pose (ángulos y alineación corporal) y decide en qué estado está
// la persona, si una repetición es válida y qué mensaje mostrar. No toca React
// ni el DOM: es lógica pura y testeable de forma aislada.

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
  // Umbral para considerar los brazos extendidos y quedar "listo" para contar.
  topAngle: 158,
  // Umbral que inicia el descenso.
  descendAngle: 148,
  // Profundidad mínima (codo cerrado) para que la repetición cuente.
  depthAngle: 96,
  // Al subir de la zona baja, se considera que ya está en ascenso.
  riseAngle: 118,
  // Alineación mínima del cuerpo: hombro -> cadera -> tobillo (plancha recta).
  minBodyAngle: 150,
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

  // Transición genérica: TOP -> DESCENDING -> BOTTOM -> ASCENDING -> TOP
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
    // Sin dato de alineación no se penaliza: solo se exige cuando se mide.
    const bodyOk =
      typeof bodyAngle === 'number' && !Number.isNaN(bodyAngle) ? bodyAngle >= config.minBodyAngle : true

    switch (state) {
      case PUSHUP_STATES.IDLE:
        goTo(PUSHUP_STATES.TOP)
        resetCycle()
        // Si la persona aparece con los brazos estirados, queda lista para iniciar un ciclo.
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
          // Empieza el descenso: sólo cuenta si veníamos de arriba.
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
          // Se arrepintió antes de bajar: reinicia sin contar.
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
            // Bajó poco, no se mantuvo o perdió la alineación: no es válida.
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
            setFeedback('Repetición válida')
          }
          armed = true
          depthReached = false
          bottomFrames = 0
          bottomSince = null
          goTo(PUSHUP_STATES.TOP)
        } else if (elbowAngle < config.depthAngle) {
          // Volvió a bajar sin completar el ascenso: sigue en ciclo inválido.
          goTo(PUSHUP_STATES.DESCENDING)
        }
        break

      default:
        goTo(PUSHUP_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    return {
      state,
      stateLabel: PUSHUP_STATE_LABELS[state] ?? 'Sin persona',
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

// Extrae los puntos necesarios para flexiones desde los landmarks de MediaPipe.
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
