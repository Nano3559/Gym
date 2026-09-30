// Pruebas de la maquina de estados de sentadillas. Se ejecutan con:
//   node scripts/squat-analyzer.test.mjs
// Cubren los 8 casos de aceptacion definidos para el contador de repeticiones.

import assert from 'node:assert/strict'
import { createSquatAnalyzer } from '../src/lib/squatAnalyzer.js'

const FRAME_MS = 33

function makeRig() {
  const state = { angle: 175, hipBelowKnee: false, visible: true, time: 0 }

  const feed = (angle, frames = 1, { hipBelowKnee = false, visible = true } = {}) => {
    let snapshot
    for (let i = 0; i < frames; i += 1) {
      state.angle = angle
      state.hipBelowKnee = hipBelowKnee
      state.visible = visible
      state.time += FRAME_MS
      snapshot = analyzer.update({
        kneeAngle: visible ? angle : null,
        hip: { x: 0.5, y: hipBelowKnee ? 0.6 : 0.4, visibility: visible ? 1 : 0 },
        knee: { x: 0.5, y: 0.5, visibility: visible ? 1 : 0 },
        visibility: visible ? 1 : 0,
        timestamp: state.time,
      })
    }
    return snapshot
  }

  const analyzer = createSquatAnalyzer()
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

test('CASO 1: persona de pie no aumenta el contador', () => {
  const { feed } = makeRig()
  feed(172, 40)
  assert.equal(feed(170).repCount, 0)
  assert.equal(feed(174).state, 'STANDING')
})

test('CASO 2: descenso parcial no aumenta el contador', () => {
  const { feed } = makeRig()
  feed(170, 30)
  feed(140, 10)
  feed(130, 15)
  assert.equal(feed(128).repCount, 0)
  assert.equal(feed(128).state, 'DESCENDING')
})

test('CASO 3: sentadilla completa suma 1', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(145, 5)
  feed(95, 12, { hipBelowKnee: true })
  assert.equal(feed(95, 5, { hipBelowKnee: true }).state, 'BOTTOM')
  assert.equal(feed(130, 8).repCount, 0)
  assert.equal(feed(168, 10).repCount, 1)
})

test('CASO 4: permanecer abajo no sigue aumentando', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(140, 5)
  feed(90, 5, { hipBelowKnee: true })
  feed(95, 200, { hipBelowKnee: true })
  assert.equal(feed(95, 10, { hipBelowKnee: true }).repCount, 0)
})

test('CASO 5: varios ciclos suman una repeticion por ciclo', () => {
  const { feed } = makeRig()
  feed(172, 30)
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    feed(145, 5)
    feed(95, 8, { hipBelowKnee: true })
    feed(135, 6)
    feed(170, 6)
    assert.equal(feed(172).repCount, cycle, `ciclo ${cycle}`)
  }
})

test('CASO 6: perder la pose no deja el contador en un ciclo invalido', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(140, 5)
  feed(95, 6, { hipBelowKnee: true })
  const lost = feed(null, 40, { visible: false })
  assert.equal(lost.state, 'IDLE')
  feed(172, 10)
  feed(145, 5)
  feed(95, 8, { hipBelowKnee: true })
  feed(135, 6)
  assert.equal(feed(170, 8).repCount, 1)
})

test('CASO 7:Extension insuficiente de la parte baja no cuenta', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(145, 5)
  feed(95, 1, { hipBelowKnee: true })
  feed(140, 4)
  assert.equal(feed(170, 10).repCount, 0)
})

test('CASO 8: remontar sin haber bajado no cuenta', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(120, 3)
  feed(172, 15)
  assert.equal(feed(170).repCount, 0)
})

test('reset deja el contador en cero', () => {
  const { analyzer, feed } = makeRig()
  feed(172, 30)
  feed(145, 5)
  feed(95, 8, { hipBelowKnee: true })
  feed(135, 6)
  feed(170, 8)
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
