// Pruebas de la maquina de estados de polichinelas (jumping jacks). Se ejecutan
// con:
//   node scripts/jack-analyzer.test.mjs
//
// Entradas: ángulo de separación de piernas (tobillo-cadera-tobillo) y la
// altura de las muñecas relativa a la cabeza (y hacia abajo: encima = menor).

import assert from 'node:assert/strict'
import { createJackAnalyzer } from '../src/lib/jackAnalyzer.js'

const FRAME_MS = 33
const HEAD_Y = 0.2
const WRIST_DOWN = 0.35
const WRIST_UP = 0.12
const CLOSED = 10
const OPEN = 70

function makeRig() {
  const state = { spread: CLOSED, leftWrist: WRIST_DOWN, rightWrist: WRIST_DOWN, visible: true, time: 0 }

  const feed = (spread, frames = 1, { leftWrist, rightWrist, visible = true } = {}) => {
    let snapshot
    for (let i = 0; i < frames; i += 1) {
      state.spread = spread
      state.leftWrist = leftWrist ?? WRIST_DOWN
      state.rightWrist = rightWrist ?? WRIST_DOWN
      state.visible = visible
      state.time += FRAME_MS
      snapshot = analyzer.update({
        spreadAngle: visible ? spread : null,
        headY: HEAD_Y,
        wristLeftY: visible ? state.leftWrist : null,
        wristRightY: visible ? state.rightWrist : null,
        visibility: visible ? 1 : 0,
        timestamp: state.time,
      })
    }
    return snapshot
  }

  const analyzer = createJackAnalyzer()
  return { analyzer, feed }
}

const results = []
function test(name, fn) {
  try {
    fn()
    results.push({ name, ok: true })
  } catch (error) {
    results.push({ name, ok: false, error })
  }
}

test('CASO 1: pies juntos estables no aumentan el contador', () => {
  const { feed } = makeRig()
  feed(CLOSED, 40)
  assert.equal(feed(CLOSED).repCount, 0)
  assert.equal(feed(CLOSED).state, 'READY')
})

test('CASO 2: abrir piernas sin brazos arriba no cuenta', () => {
  const { feed } = makeRig()
  feed(CLOSED, 30)
  feed(OPEN, 15, { leftWrist: WRIST_DOWN, rightWrist: WRIST_DOWN })
  assert.equal(feed(OPEN).repCount, 0)
  feed(CLOSED, 10, { leftWrist: WRIST_UP, rightWrist: WRIST_UP })
  assert.equal(feed(CLOSED).repCount, 0)
})

test('CASO 3: polichinela completa suma 1', () => {
  const { feed } = makeRig()
  feed(CLOSED, 30)
  feed(OPEN, 12, { leftWrist: WRIST_UP, rightWrist: WRIST_UP })
  assert.equal(feed(OPEN, 5, { leftWrist: WRIST_UP, rightWrist: WRIST_UP }).state, 'UP')
  assert.equal(feed(CLOSED, 10).repCount, 1)
})

test('CASO 4: mantener la apertura no sigue aumentando', () => {
  const { feed } = makeRig()
  feed(CLOSED, 30)
  feed(OPEN, 200, { leftWrist: WRIST_UP, rightWrist: WRIST_UP })
  assert.equal(feed(OPEN, 10, { leftWrist: WRIST_UP, rightWrist: WRIST_UP }).repCount, 0)
})

test('CASO 5: varios ciclos suman una repeticion por ciclo', () => {
  const { feed } = makeRig()
  feed(CLOSED, 30)
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    feed(OPEN, 8, { leftWrist: WRIST_UP, rightWrist: WRIST_UP })
    feed(CLOSED, 6)
    assert.equal(feed(CLOSED).repCount, cycle, `ciclo ${cycle}`)
  }
})

test('CASO 6: perder la pose no deja el contador en un ciclo invalido', () => {
  const { feed } = makeRig()
  feed(CLOSED, 30)
  feed(OPEN, 6, { leftWrist: WRIST_UP, rightWrist: WRIST_UP })
  const lost = feed(null, 40, { visible: false })
  assert.equal(lost.state, 'IDLE')
  feed(CLOSED, 10)
  feed(OPEN, 12, { leftWrist: WRIST_UP, rightWrist: WRIST_UP })
  assert.equal(feed(CLOSED, 10).repCount, 1)
})

test('CASO 7: abrir y cerrar sin brazos arriba no cuenta', () => {
  const { feed } = makeRig()
  feed(CLOSED, 30)
  feed(OPEN, 30, { leftWrist: WRIST_DOWN, rightWrist: WRIST_DOWN })
  feed(CLOSED, 10)
  assert.equal(feed(CLOSED).repCount, 0)
})

test('CASO 8: aparecer ya con piernas abiertas no cuenta', () => {
  const { feed } = makeRig()
  feed(OPEN, 30, { leftWrist: WRIST_UP, rightWrist: WRIST_UP })
  assert.equal(feed(OPEN).repCount, 0)
  feed(CLOSED, 10)
  assert.equal(feed(CLOSED).repCount, 0)
})

test('reset deja el contador en cero', () => {
  const { analyzer, feed } = makeRig()
  feed(CLOSED, 30)
  feed(OPEN, 8, { leftWrist: WRIST_UP, rightWrist: WRIST_UP })
  feed(CLOSED, 10)
  assert.equal(analyzer.snapshot().repCount, 1)
  analyzer.reset()
  assert.equal(analyzer.snapshot().repCount, 0)
})

let failed = 0
for (const result of results) {
  if (result.ok) {
    console.log(`ok   ${result.name}`)
  } else {
    failed += 1
    console.error(`FAIL ${result.name}\n     ${result.error.message}`)
  }
}
console.log(`\n${results.length - failed}/${results.length} pruebas correctas`)
process.exit(failed === 0 ? 0 : 1)