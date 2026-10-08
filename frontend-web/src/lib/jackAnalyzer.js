// Analizador de polichinelas (jumping jacks) en tiempo real.
//
// Es una detección por distancias relativas y ejes: una repetición válida es
// separar las piernas (el ángulo entre los tobillos visto desde la cadera se
// abre) mientras las muñecas quedan por encima de la cabeza, y volver a la
// posición inicial con los pies juntos. Lógica pura y testeable de forma
// aislada.

export const JACK_STATES = {
  IDLE: 'IDLE',
  READY: 'READY',
  JUMPING: 'JUMPING',
  UP: 'UP',
  RETURNING: 'RETURNING',
}

export const JACK_STATE_LABELS = {
  IDLE: 'Sin persona',
  READY: 'De pie, pies juntos',
  JUMPING: 'Saltando',
  UP: 'Pies abiertos, brazos arriba',
  RETURNING: 'Volviendo',
}

export const DEFAULT_JACK_CONFIG = {
  // Ángulo de separación (tobillo-cadera-tobillo) que considera "piernas abiertas".
  spreadDeg: 45,
  // Ángulo para considerar las piernas juntas (posición inicial / fin de ciclo).
  readyDeg: 24,
  // Margen (ejes normalizados) para considerar las muñecas a la altura de la
  // cabeza o por encima de ella. Con y hacia abajo, encima = menor valor.
  wristsUpMargin: 0.03,
  // Estabilidad mínima en la posición arriba (frames y/o milisegundos).
  minTopFrames: 2,
  minTopMs: 80,
  // Visibilidad mínima de los landmarks clave (MediaPipe 0..1).
  minVisibility: 0.55,
  // Si no hay pose válida durante este tiempo, se resetea el contador de ciclo.
  trackingTimeoutMs: 900,
}

export function createJackAnalyzer(userConfig = {}) {
  const config = { ...DEFAULT_JACK_CONFIG, ...userConfig }

  let state = JACK_STATES.IDLE
  let repCount = 0
  let armed = false
  let topReached = false
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
    topReached = false
    topFrames = 0
    topSince = null
    cycleStart = null
  }

  // Transición genérica: READY -> JUMPING -> UP -> RETURNING -> READY
  const goTo = (next) => {
    state = next
  }

  function update({ spreadAngle, headY, wristLeftY, wristRightY, visibility = 1, timestamp = 0 }) {
    if (
      typeof spreadAngle !== 'number' ||
      Number.isNaN(spreadAngle) ||
      typeof headY !== 'number' ||
      Number.isNaN(headY) ||
      visibility < config.minVisibility
    ) {
      const timedOut = lastTrackedAt !== null && timestamp - lastTrackedAt > config.trackingTimeoutMs
      if (timedOut || state === JACK_STATES.IDLE) {
        resetCycle()
        goTo(JACK_STATES.IDLE)
        setFeedback('Colócate de frente, con el cuerpo entero visible')
      }
      return snapshot()
    }

    lastTrackedAt = timestamp
    const wristsUp =
      typeof wristLeftY === 'number' &&
      typeof wristRightY === 'number' &&
      wristLeftY <= headY + config.wristsUpMargin &&
      wristRightY <= headY + config.wristsUpMargin
    const topConditions = spreadAngle >= config.spreadDeg && wristsUp
    const readyConditions = spreadAngle <= config.readyDeg

    switch (state) {
      case JACK_STATES.IDLE:
        goTo(JACK_STATES.READY)
        resetCycle()
        // Si aparece ya con los pies juntos, queda lista para iniciar un ciclo.
        if (readyConditions) {
          armed = true
          setFeedback('Posición inicial lista')
        }
        break

      case JACK_STATES.READY:
        if (readyConditions) {
          armed = true
          topReached = false
          setFeedback('Posición inicial')
        } else if (topConditions) {
          // Empieza el salto: sólo cuenta si veníamos de la posición inicial.
          if (armed) {
            goTo(JACK_STATES.JUMPING)
            topFrames = 0
            topSince = timestamp
            cycleStart = timestamp
            setFeedback('Abre piernas y brazos')
          }
        }
        break

      case JACK_STATES.JUMPING:
        topFrames += 1
        if (topConditions) {
          const stableFrames = topFrames >= config.minTopFrames
          const stableMs = topSince !== null && timestamp - topSince >= config.minTopMs
          if (stableFrames && stableMs) {
            goTo(JACK_STATES.UP)
            topReached = true
            setFeedback('Pies abiertos, brazos arriba')
          }
        } else {
          // Se cerró el salto antes de estabilizar la apertura: no es válido.
          resetCycle()
          armed = true
          setFeedback('Posición inicial')
        }
        break

      case JACK_STATES.UP:
        topFrames += 1
        if (!topConditions) {
          const stableFrames = topFrames >= config.minTopFrames
          const stableMs = topSince !== null && timestamp - topSince >= config.minTopMs
          if (topReached && stableFrames && stableMs) {
            goTo(JACK_STATES.RETURNING)
            setFeedback('Junta los pies')
          } else {
            // No se mantuvo lo suficiente arriba: movimiento no válido.
            resetCycle()
            armed = true
            goTo(JACK_STATES.READY)
            setFeedback('Haz el salto completo')
          }
        }
        break

      case JACK_STATES.RETURNING:
        if (readyConditions) {
          if (topReached) {
            repCount += 1
            setFeedback('Repetición válida')
          }
          armed = true
          topReached = false
          topFrames = 0
          topSince = null
          goTo(JACK_STATES.READY)
        } else if (topConditions) {
          // Volvió a abrir sin completar el cierre: sigue en ciclo inválido.
          goTo(JACK_STATES.UP)
        }
        break

      default:
        goTo(JACK_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    return {
      state,
      stateLabel: JACK_STATE_LABELS[state] ?? 'Sin persona',
      repCount,
      feedback: lastFeedback,
      topReached,
      armed,
      cycleStart,
      lastTrackedAt,
    }
  }

  function reset() {
    resetCycle()
    goTo(JACK_STATES.IDLE)
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

// Extrae los puntos necesarios para polichinelas desde los landmarks de
// MediaPipe: cabeza y muñecas para el brazo arriba y caderas/tobillos para la
// apertura de piernas.
export const JACK_LANDMARKS = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftAnkle: 27,
  rightAnkle: 28,
}