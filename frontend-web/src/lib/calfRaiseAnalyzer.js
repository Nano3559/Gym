// Analizador de elevación de pantorrillas (calf raises) en tiempo real.
//
// En lugar de confiar en el pequeño cambio del ángulo del tobillo, se valida el
// desplazamiento vertical de los hombros: cuando la persona sube apoyándose en
// la punta de los pies, la línea de los hombros se eleva y luego vuelve a su
// posición inicial. La referencia (baseline) se ancla a la posición de pie más
// baja detectada. Es lógica pura y testeable de forma aislada.

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
  // Subida requerida como fracción de la longitud de pierna visible.
  riseRatio: 0.06,
  // Mínimo absoluto de subida (en coordenadas normalizadas 0..1).
  minRise: 0.012,
  // Al bajar, la repetición cuenta cuando queda menos de esta fracción de la
  // subida requerida (prácticamente de vuelta a la posición inicial).
  downThreshold: 0.15,
  // Tras estabilizarse arriba, se sale a LOWERING cuando queda menos de esta
  // fracción de la subida requerida.
  leaveRatio: 0.6,
  // Si se abandona la elevación antes de estabilizarse, el ciclo no cuenta.
  partialRatio: 0.5,
  // Estabilidad mínima en la posición alta (frames y/o milisegundos).
  minTopFrames: 3,
  minTopMs: 110,
  // Histéresis en el eje Y (unidades normalizadas) para no alternar por ruido.
  hysteresis: 0.004,
  // Visibilidad mínima de los landmarks clave (MediaPipe 0..1).
  minVisibility: 0.55,
  // Si no hay pose válida durante este tiempo, se resetea el contador de ciclo.
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
  const yHistory = []

  const setFeedback = (message) => {
    lastFeedback = message
  }

  const resetCycle = () => {
    topFrames = 0
    topSince = null
    cycleStart = null
  }

  // Pequeña media móvil propia del eje Y (el smoother del hook suaviza el
  // ángulo; aquí la referencia vertical necesita su propio filtro).
  const smoothY = (value) => {
    yHistory.push(value)
    if (yHistory.length > Y_SMOOTH_WINDOW) yHistory.shift()
    return yHistory.reduce((sum, item) => sum + item, 0) / yHistory.length
  }

  const requiredRise = (heightRef) => Math.max(config.minRise, config.riseRatio * (heightRef ?? 0))

  // Transición genérica: DOWN -> RISING -> RAISED -> LOWERING -> DOWN
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

    switch (state) {
      case CALF_STATES.IDLE:
        goTo(CALF_STATES.DOWN)
        resetCycle()
        baselineY = y
        setFeedback('Posición inicial')
        break

      case CALF_STATES.DOWN:
        // La referencia se ancla a la posición de pie más baja y se reajusta
        // con suavidad cuando la persona está prácticamente de pie.
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
          // No llegó a la altura suficiente o volvió antes de estabilizarse.
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
            // Se bajó sin mantener la punta: elevación no válida.
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
          setFeedback('Repetición válida')
          resetCycle()
          goTo(CALF_STATES.DOWN)
        } else if (baselineY - y >= required) {
          // Volvió a subir sin completar el descenso: sigue sin contar.
          goTo(CALF_STATES.RAISED)
        }
        break

      default:
        goTo(CALF_STATES.IDLE)
    }

    return snapshot()
  }

  function snapshot() {
    return {
      state,
      stateLabel: CALF_STATE_LABELS[state] ?? 'Sin persona',
      repCount,
      feedback: lastFeedback,
      baselineY,
      topFrames,
      cycleStart,
      lastTrackedAt,
    }
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

// Extrae los puntos necesarios para pantorrillas desde los landmarks de
// MediaPipe. Se usan hombros y caderas para el desplazamiento vertical y el
// pie para el ángulo de tobillo que se muestra como métrica.
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