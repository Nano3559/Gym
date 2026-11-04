// Medición de rendimiento y degradación adaptativa de la inferencia.
//
// El bucle de `usePoseDetection` no puede mantener 30 inferencias por segundo en
// todos los móviles. Cuando no llega, lo primero que se nota es que el contador
// va con retraso. Este módulo decide, a partir del coste real de cada
// inferencia, a qué resolución y a qué frecuencia se infiere.
//
// Decisión por COSTE y no por FPS alcanzados, porque el FPS alcanzado está
// limitado por la frecuencia que el propio nivel pide: un móvil que rinde de
// sobra siempre marca "20 FPS" en calidad media y parecería que no puede más.
// El tiempo que tarda `detectForVideo` sí revela si queda margen.
//
// Es lógica pura (sin DOM ni temporizadores) para poder probarla en Node.

// Niveles ordenados de mejor a peor.
//
// Primero baja la RESOLUCIÓN y solo después la FRECUENCIA: reducir la
// resolución abarata la inferencia sin restar fluidez (el video se dibuja
// siempre a 30 FPS aunque se infiera menos veces), mientras que bajar la
// frecuencia hace que el conteo de repeticiones responda más tarde.
export const QUALITY_LEVELS = [
  { name: 'alta', inferenceFps: 30, scale: 1 },
  { name: 'media', inferenceFps: 30, scale: 0.75 },
  { name: 'baja', inferenceFps: 20, scale: 0.6 },
]

export const DEFAULT_PERF_CONFIG = {
  // Objetivo de la guía: 30 inferencias por segundo.
  targetFps: 30,
  // Ventana de medición. Corta para reaccionar rápido, larga para no cambiar
  // de nivel por un pico puntual.
  windowMs: 2000,
  // El presupuesto de una inferencia es 1000 / targetFps. Si el coste medio lo
  // supera, no hay margen y se degrada.
  degradeCostRatio: 0.8,
  // Si el coste medio cae muy por debajo, sobra margen y se recupera un nivel.
  recoverCostRatio: 0.45,
  // Se ignoran los primeros frames: el arranque del detector siempre es lento
  // y degradaría la calidad sin motivo.
  warmupFrames: 12,
}

// Trabajo relativo de un nivel: frecuencia pedida × área procesada.
function workOf(level) {
  return level.inferenceFps * level.scale * level.scale
}

export function intervalForFps(inferenceFps) {
  return 1000 / inferenceFps
}

export function createFpsMonitor(overrides = {}) {
  const config = { ...DEFAULT_PERF_CONFIG, ...overrides }
  const budget = 1000 / config.targetFps

  let levelIndex = 0
  let frames = 0
  let costTotal = 0
  let warmup = 0
  let windowStart = null
  let fps = 0
  let avgCostMs = 0

  function reset() {
    levelIndex = 0
    frames = 0
    costTotal = 0
    warmup = 0
    windowStart = null
    fps = 0
    avgCostMs = 0
  }

  // Se llama en cada inferencia completada, con `now` y los milisegundos que
  // tardó `detectForVideo`. Solo cambia de nivel al cerrar una ventana completa.
  function tick(now, costMs = 0) {
    // El calentamiento no abre ventana: si fijara el origen, la primera
    // medición incluiría los frames lentos de arranque y degradaría la calidad
    // sin motivo.
    if (warmup < config.warmupFrames) {
      warmup += 1
      return snapshot(false)
    }

    if (windowStart === null) windowStart = now
    frames += 1
    costTotal += Math.max(0, costMs)

    const elapsed = now - windowStart
    if (elapsed < config.windowMs) return snapshot(false)

    fps = (frames * 1000) / elapsed
    avgCostMs = costTotal / frames

    const current = QUALITY_LEVELS[levelIndex]
    let changed = false

    if (avgCostMs > budget * config.degradeCostRatio) {
      if (levelIndex < QUALITY_LEVELS.length - 1) {
        levelIndex += 1
        changed = true
      }
    } else if (levelIndex > 0) {
      // Solo se recupera si el nivel anterior sería sostenible a este coste.
      // Subir porque "ahora voy bien" hace oscilar: se sube, el coste sube con
      // él y se vuelve a bajar cada ventana.
      const previous = QUALITY_LEVELS[levelIndex - 1]
      const previousCost = avgCostMs * (workOf(previous) / workOf(current))
      if (previousCost <= budget * config.degradeCostRatio) {
        levelIndex -= 1
        changed = true
      }
    }

    // Se cierra la ventana: los frames cuentan para la siguiente medición.
    frames = 0
    costTotal = 0
    windowStart = now

    return snapshot(changed)
  }

  function snapshot(changed) {
    const level = QUALITY_LEVELS[levelIndex]
    return {
      fps: Math.round(fps),
      levelIndex,
      level: level.name,
      inferenceFps: level.inferenceFps,
      scale: level.scale,
      intervalMs: intervalForFps(level.inferenceFps),
      avgCostMs: Math.round(avgCostMs * 10) / 10,
      budgetMs: Math.round(budget),
      changed,
      isDegraded: levelIndex > 0,
    }
  }

  return { tick, reset, config, getState: snapshot }
}
