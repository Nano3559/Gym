// Analizador de curl de bíceps en tiempo real.
//
// Usa los mismos landmarks que la flexión (hombro, codo, muñeca) y solo cambian
// las condiciones: el brazo estirado (~160°) es la posición inicial y el brazo
// flexionado (~30°) marca el punto medio de la repetición. Lógica pura y
// testeable de forma aislada, igual que el analizador de sentadillas.

export const CURL_STATES = {
  IDLE: 'IDLE',
  EXTENDED: 'EXTENDED',
  FLEXING: 'FLEXING',
  FLEXED: 'FLEXED',
  EXTENDING: 'EXTENDING',
}

export const CURL_STATE_LABELS = {
  IDLE: 'Sin persona',
  EXTENDED: 'Brazo extendido',
  FLEXING: 'Flexionando',
  FLEXED: 'Contracción máxima',
  EXTENDING: 'Extendiendo',
}

export const DEFAULT_CURL_CONFIG = {
  // Umbral para considerar el brazo estirado y "listo" para contar.
  extendedAngle: 158,
  // Umbral que inicia la flexión del codo.
  flexAngle: 148,
  // Codo máximo (brazo flexionado ~30°) para que la repetición cuente.
  peakAngle: 35,
  // Al abrir el codo desde la contracción, se considera que ya extiende.
  extendAngle: 50,
  // Estabilidad mínima en la contracción máxima (frames y/o milisegundos).
  minPeakFrames: 3,
  minPeakMs: 110,
  // Margen de histeresis para no alternar estados por ruido.
  hysteresis: 4,
  // Visibilidad mínima de los landmarks clave (MediaPipe 0..1).
  minVisibility: 0.55,
  // Si no hay pose válida durante este tiempo, se resetea el contador de ciclo.
  trackingTimeoutMs: 900,
}

export function createCurlAnalyzer(userConfig = {}) {
  const config = { ...DEFAULT_CURL_CONFIG, ...userConfig }

  let state = CURL_STATES.IDLE
  let repCount = 0
  let armed = false
  let depthReached = false
  let peakFrames = 0
  let peakSince = null
  let cycleStart = null
  let lastTrackedAt = null
  let lastFeedback = ''

  const setFeedback = (message) => {
    lastFeedback = message
  }

  const resetCycle = () => {
    armed = false
    depthReached = false
    peakFrames = 0
    peakSince = null
    cycleStart = null
  }

  // Transición genérica: EXTENDED -> FLEXING -> FLEXED -> EXTENDING -> EXTENDED
  const goTo = (next) => {
    state = next
  }

  function update({ elbowAngle, visibility = 1, timestamp = 0 }) {
    if (typeof elbowAngle !== 'number' || Number.isNaN(elbowAngle) || visibility < config.minVisibility) {
      const timedOut = lastTrackedAt !== null && timestamp - lastTrackedAt > config.trackingTimeoutMs
      if (timedOut || state === CURL_STATES.IDLE) {
        resetCycle()
        goTo(CURL_STATES.IDLE)
        setFeedback('Colócate de lado, con el brazo en el aire')
      }
      return snapshot()
    }

    lastTrackedAt = timestamp

    switch (state) {
      case CURL_STATES.IDLE:
        goTo(CURL_STATES.EXTENDED)
        resetCycle()
        // Si aparece con el brazo ya estirado, queda listo para iniciar un ciclo.
        if (elbowAngle >= config.extendedAngle) {
          armed = true
          setFeedback('Posición inicial lista')
        }
        break

      case CURL_STATES.EXTENDED:
        if (elbowAngle >= config.extendedAngle + config.hysteresis) {
          armed = true
          depthReached = false
          setFeedback('Posición inicial')
        } else if (elbowAngle < config.flexAngle) {
          // Empieza la flexión: sólo cuenta si veníamos del brazo estirado.
          if (armed) {
            goTo(CURL_STATES.FLEXING)
            cycleStart = timestamp
            setFeedback('Flexiona el codo')
          }
        }
        break

      case CURL_STATES.FLEXING:
        if (elbowAngle <= config.peakAngle) {
          goTo(CURL_STATES.FLEXED)
          depthReached = true
          peakFrames = 0
          peakSince = timestamp
          setFeedback('Contracción completa')
        } else if (elbowAngle > config.extendedAngle - config.hysteresis) {
          // Se arrepintió antes de flexionar: reinicia sin contar.
          resetCycle()
          armed = true
          setFeedback('Posición inicial')
        }
        break

      case CURL_STATES.FLEXED:
        peakFrames += 1
        if (elbowAngle > config.extendAngle) {
          const stableFrames = peakFrames >= config.minPeakFrames
          const stableMs = peakSince !== null && timestamp - peakSince >= config.minPeakMs
          if (depthReached && stableFrames && stableMs) {
            goTo(CURL_STATES.EXTENDING)
            setFeedback('Extiende el brazo')
          } else {
            // No llegó a la contracción o no se mantuvo: movimiento no válido.
            resetCycle()
            armed = true
            goTo(CURL_STATES.EXTENDED)
            setFeedback('Flexiona más el codo')
          }
        } else {
          setFeedback('Contracción máxima')
        }
        break

      case CURL_STATES.EXTENDING:
        if (elbowAngle >= config.extendedAngle - config.hysteresis) {
          if (depthReached) {
            repCount += 1
            setFeedback('Repetición válida')
          }
          armed = true
          depthReached = false
          peakFrames = 0
          peakSince = null
          goTo(CURL_STATES.EXTENDED)
        } else if (elbowAngle < config.peakAngle) {
          // Volvió a flexionar sin completar la extensión: ciclo inválido.
          goTo(CURL_STATES.FLEXING)
        }
        break

      default:
        goTo(CURL_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    return {
      state,
      stateLabel: CURL_STATE_LABELS[state] ?? 'Sin persona',
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
    goTo(CURL_STATES.IDLE)
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

// Extrae los puntos necesarios para el curl desde los landmarks de MediaPipe.
export const CURL_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
}