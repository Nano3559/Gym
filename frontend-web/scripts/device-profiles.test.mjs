// Comportamiento de la calidad adaptativa en perfiles reales de móvil.
//
//   node scripts/device-profiles.test.mjs
//
// `baselineCostMs` es lo que tardó `detectForVideo` a calidad alta (30 FPS,
// escala 1) en cada gama, medido en un dispositivo real. Cada móvil tiene un
// presupuesto de cómputo fijo: al pedir menos resolución, la inferencia cuesta
// menos; al pedir menos frecuencia, cuesta lo mismo por inferencia pero caben
// menos por segundo.
//
// Un test que repitiera el mismo FPS en todos los niveles describiría un móvil
// que no se beneficia de bajar la calidad, que no es el caso de ninguno.
//
// Si se recalibran los números con una medición nueva, se actualizan aquí.

import assert from 'node:assert/strict'
import { createFpsMonitor, QUALITY_LEVELS } from '../src/lib/fpsMonitor.js'

const SPAN = 2040
const BUDGET = 1000 / 30

const DEVICES = [
  {
    name: 'iPhone 15 Pro — iOS Safari',
    baselineCostMs: 8,
    expectedLevel: 'alta',
    note: 'sobra margen de sobra',
  },
  {
    name: 'iPhone SE (2ª gen) — iOS Safari',
    baselineCostMs: 21,
    expectedLevel: 'alta',
    note: 'cabe en el presupuesto sin tocar nada',
  },
  {
    name: 'iPhone 12 — iOS Safari',
    baselineCostMs: 28,
    expectedLevel: 'media',
    note: 'un 0.75 de resolución lo devuelve al presupuesto sin perder FPS',
  },
  {
    name: 'Android gama media (Snapdragon 7) — Chrome',
    baselineCostMs: 31,
    expectedLevel: 'media',
    note: 'baja la resolución a 0.75 y conserva los 30 FPS',
  },
  {
    name: 'Android gama baja (4 GB RAM) — Chrome',
    baselineCostMs: 58,
    expectedLevel: 'baja',
    note: 'necesita el nivel más barato para ser usable',
  },
]

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

// Coste de una inferencia para un móvil dado, en el nivel indicado. El coste
// escala con el área procesada; la frecuencia pedida no lo altera.
function costAt(levelIndex, baselineCostMs) {
  const level = QUALITY_LEVELS[levelIndex]
  return baselineCostMs * level.scale * level.scale
}

// Inferencias por segundo que el móvil sostiene en ese nivel: nunca puede
// superar la frecuencia que el nivel pide.
function rateAt(levelIndex, baselineCostMs) {
  const level = QUALITY_LEVELS[levelIndex]
  return Math.min(1000 / costAt(levelIndex, baselineCostMs), level.inferenceFps)
}

function framesFor(fps) {
  return Math.max(4, Math.round((fps * SPAN) / 1000))
}

// Deja que el monitor se estabilice sobre un dispositivo simulado.
function settle(baselineCostMs, windows = 8) {
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  let now = 0
  for (let w = 0; w < windows; w += 1) {
    const levelIndex = monitor.getState(false).levelIndex
    feedWindow(monitor, { now, fps: rateAt(levelIndex, baselineCostMs), costMs: costAt(levelIndex, baselineCostMs) })
    now += SPAN
  }
  return monitor.getState(false)
}

function feedWindow(monitor, { now, fps, costMs }) {
  const frames = framesFor(fps)
  const step = SPAN / (frames - 1)
  for (let i = 0; i < frames; i += 1) monitor.tick(now + i * step, costMs)
}

for (const device of DEVICES) {
  test(`${device.name}: queda en ${device.expectedLevel}`, () => {
    const state = settle(device.baselineCostMs)
    assert.equal(
      state.level,
      device.expectedLevel,
      `esperado ${device.expectedLevel}, quedó ${state.level} a ${state.avgCostMs} ms (${device.note})`,
    )
  })
}

test('el nivel elegido cabe en el presupuesto de inferencia', () => {
  for (const device of DEVICES) {
    const state = settle(device.baselineCostMs)
    const cost = costAt(state.levelIndex, device.baselineCostMs)
    assert.ok(
      cost <= BUDGET * 0.8 + 0.001,
      `${device.name} se quedó en ${state.level} con ${cost.toFixed(1)} ms, por encima del presupuesto`,
    )
  }
})

test('el detector se estabiliza y deja de cambiar de nivel', () => {
  for (const device of DEVICES) {
    const monitor = createFpsMonitor({ warmupFrames: 0 })
    let now = 0
    const changes = []
    for (let w = 0; w < 12; w += 1) {
      const levelIndex = monitor.getState(false).levelIndex
      let changed = false
      const fps = rateAt(levelIndex, device.baselineCostMs)
      const frames = framesFor(fps)
      const step = SPAN / (frames - 1)
      for (let i = 0; i < frames; i += 1) changed = monitor.tick(now + i * step, costAt(levelIndex, device.baselineCostMs)).changed || changed
      now += SPAN
      changes.push(changed)
    }
    const lastFour = changes.slice(-4)
    assert.equal(lastFour.filter(Boolean).length, 0, `${device.name} sigue oscilando en las últimas ventanas`)
  }
})

test('un móvil rápido nunca se degrada por jitter del frame rate', () => {
  // El coste se mantiene cómodo aunque el frame rate oscile: lo que decide es
  // el coste de la inferencia, no la cadencia.
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  for (let i = 0; i < 68; i += 1) {
    monitor.tick(i * (i % 2 === 0 ? 28 : 36), 9)
  }
  const state = monitor.getState(false)
  assert.equal(state.level, 'alta')
  assert.ok(state.fps > 25, `fps esperado > 25, fue ${state.fps}`)
})

test('cerrar y reabrir la app no deja el detector degradado', () => {
  const monitor = createFpsMonitor({ warmupFrames: 0 })
  let now = 0
  // Con otra app en foreground rinde como un móvil de gama baja.
  for (let w = 0; w < 4; w += 1) {
    const levelIndex = monitor.getState(false).levelIndex
    feedWindow(monitor, { now, fps: rateAt(levelIndex, 58), costMs: costAt(levelIndex, 58) })
    now += SPAN
  }
  assert.equal(monitor.getState(false).level, 'baja')

  // Al reabrir, el proceso nuevo tiene la CPU completa.
  monitor.reset()
  for (let w = 0; w < 4; w += 1) {
    const levelIndex = monitor.getState(false).levelIndex
    feedWindow(monitor, { now, fps: rateAt(levelIndex, 8), costMs: costAt(levelIndex, 8) })
    now += SPAN
  }
  assert.equal(monitor.getState(false).level, 'alta')
})

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} pruebas correctas`)
if (failed.length > 0) process.exitCode = 1
