// Pruebas del monitor de rendimiento y la degradación adaptativa.
//   node scripts/fps-monitor.test.mjs
//
// El monitor decide por coste de inferencia, así que los tests alimentan los
// milisegundos que tardó cada inferencia. El presupuesto es 1000/30 = 33.3 ms.

import assert from 'node:assert/strict'
import { createFpsMonitor, QUALITY_LEVELS, intervalForFps } from '../src/lib/fpsMonitor.js'

const results = []

function test(name, fn) {
  try {
    fn()
    results.push({ name, ok: true })
    console.log(`ok   ${name}`)
  } catch (error) {
    results.push({ name, ok: false, error })
    console.error(`FAIL ${name}`)
    console.error(error.message)
  }
}

const SPAN = 2040
const BUDGET = 1000 / 30

// Alimenta una ventana de inferencias de `count` frames, todas con `costMs`.
// Los tramos se encadenan sin huecos: un hueco entre ventanas se contaría como
// tiempo sin frames y falsearía la medición.
function feed(monitor, { fromMs, toMs = fromMs + SPAN, count, costMs }) {
  const step = (toMs - fromMs) / Math.max(count - 1, 1)
  let now = fromMs
  let state
  for (let i = 0; i < count; i += 1) {
    state = monitor.tick(now, costMs)
    now += step
  }
  return state
}

// Frames repartidos a `fps` dentro de una ventana de 2040 ms.
function framesFor(fps) {
  return Math.max(4, Math.round((fps * SPAN) / 1000))
}

// El coste de un móvil baja en la misma proporción que el área procesada: al
// pasar a escala 0.75 la inferencia cuesta un 0.75² = 56% de lo que costaba.
function costAtScale(baselineCostMs, scale) {
  return baselineCostMs * scale * scale
}

test('con margen de sobra se queda en calidad alta', () => {
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  const state = feed(monitor, { fromMs: 0, count: framesFor(30), costMs: 10 })
  assert.equal(state.levelIndex, 0)
  assert.equal(state.level, 'alta')
  assert.equal(state.scale, 1)
  assert.equal(state.inferenceFps, 30)
  assert.ok(state.fps >= 29, `fps esperado ~30, fue ${state.fps}`)
  assert.equal(state.isDegraded, false)
})

test('ignora los frames de calentamiento sin degradar', () => {
  const monitor = createFpsMonitor() // warmupFrames = 12 por defecto
  // 12 inferencias carísimas de 300 ms: si contaran, degradarían de golpe.
  feed(monitor, { fromMs: 0, toMs: 3600, count: 12, costMs: 300 })
  assert.equal(monitor.getState(false).levelIndex, 0)

  const state = feed(monitor, { fromMs: 4000, count: framesFor(30), costMs: 10 })
  assert.equal(state.levelIndex, 0)
})

test('baja primero la resolución y no la frecuencia', () => {
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  // 28 ms supera el 80% del presupuesto (26.7 ms): degrada.
  feed(monitor, { fromMs: 0, count: framesFor(30), costMs: 28 })
  const state = monitor.getState(false)
  assert.equal(state.level, 'media')
  assert.equal(state.scale, QUALITY_LEVELS[1].scale)
  // Sigue pidiendo 30 FPS: la frecuencia no se toca hasta agotar la resolución.
  assert.equal(state.inferenceFps, 30)
})

test('solo baja la frecuencia cuando la resolución ya no basta', () => {
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  let now = 0

  // En alta, 28 ms no entran en el presupuesto -> media.
  feed(monitor, { fromMs: now, count: framesFor(30), costMs: 28 })
  now += SPAN
  assert.equal(monitor.getState(false).level, 'media')

  // En media el mismo móvil cuesta un 56%: ahí sí se sostiene y se queda.
  const costEnMedia = costAtScale(28, QUALITY_LEVELS[1].scale)
  feed(monitor, { fromMs: now, count: framesFor(30), costMs: costEnMedia })
  now += SPAN
  assert.equal(monitor.getState(false).level, 'media')

  // Si bajar la resolución no hubiera servido, toca bajar la frecuencia.
  feed(monitor, { fromMs: now, count: framesFor(20), costMs: 28 })
  now += SPAN
  const state = monitor.getState(false)
  assert.equal(state.level, 'baja')
  assert.ok(state.inferenceFps < QUALITY_LEVELS[1].inferenceFps)
})

test('recupera un nivel cuando el coste vuelve a ser bajo', () => {
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  let now = 0
  feed(monitor, { fromMs: now, count: framesFor(30), costMs: 28 })
  now += SPAN
  assert.equal(monitor.getState(false).level, 'media')

  // Coste bajo otra vez: el nivel anterior sería sostenible y se recupera.
  const state = feed(monitor, { fromMs: now, count: framesFor(30), costMs: 10 })
  assert.equal(state.level, 'alta')
  assert.equal(state.isDegraded, false)
})

test('no oscila con un coste en la zona intermedia', () => {
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  let now = 0
  const levels = []
  // 20 ms: por debajo del umbral de degradar pero por encima del de recuperar.
  for (let w = 0; w < 8; w += 1) {
    feed(monitor, { fromMs: now, count: framesFor(30), costMs: 20 })
    now += SPAN
    levels.push(monitor.getState(false).levelIndex)
  }
  assert.equal(new Set(levels).size, 1, `osciló entre niveles: ${levels.join(',')}`)
})

test('no baja del último nivel aunque cueste demasiado', () => {
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  let now = 0
  for (let w = 0; w < 6; w += 1) {
    feed(monitor, { fromMs: now, count: framesFor(12), costMs: 120 })
    now += SPAN
  }
  assert.equal(monitor.getState(false).levelIndex, QUALITY_LEVELS.length - 1)
  assert.equal(monitor.getState(false).isDegraded, true)
})

test('publica coste medio y presupuesto', () => {
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  const state = feed(monitor, { fromMs: 0, count: framesFor(30), costMs: 21.5 })
  assert.equal(state.avgCostMs, 21.5)
  assert.equal(state.budgetMs, Math.round(BUDGET))
})

test('el intervalo derivado de los FPS es el esperado', () => {
  assert.equal(Math.round(intervalForFps(30)), 33)
  assert.equal(Math.round(intervalForFps(20)), 50)
})

test('reset vuelve al nivel alto', () => {
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  feed(monitor, { fromMs: 0, count: framesFor(30), costMs: 28 })
  assert.equal(monitor.getState(false).level, 'media')
  monitor.reset()
  assert.equal(monitor.getState(false).level, 'alta')
  assert.equal(monitor.getState(false).avgCostMs, 0)
})

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} pruebas correctas`)
if (failed.length > 0) process.exitCode = 1
