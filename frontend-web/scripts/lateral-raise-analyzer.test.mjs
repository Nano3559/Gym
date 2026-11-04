// Pruebas de la maquina de estados de elevaciones laterales de hombro.
// Se ejecutan con:
//   node scripts/lateral-raise-analyzer.test.mjs

import assert from 'node:assert/strict'
import { createLateralRaiseAnalyzer } from '../src/lib/lateralRaiseAnalyzer.js'

const FRAME_MS = 33

function makeRig() {
  const state = { angle: 15, visible: true, time: 0 }

  const feed = (angle, frames = 1, { visible = true } = {}) => {
    let snapshot
    for (let i = 0; i < frames; i += 1) {
      state.angle = angle
      state.visible = visible
      state.time += FRAME_MS
      snapshot = analyzer.update({
        shoulderAngle: visible ? angle : null,
        hip: { x: 0.5, y: 0.8, visibility: visible ? 1 : 0 },
        shoulder: { x: 0.5, y: 0.5, visibility: visible ? 1 : 0 },
        elbow: { x: 0.5, y: 0.7, visibility: visible ? 1 : 0 },
        visibility: visible ? 1 : 0,
        timestamp: state.time,
      })
    }
    return snapshot
  }

  const analyzer = createLateralRaiseAnalyzer()
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

test('CASO 1: brazos abajo estables no aumentan el contador', () => {
  const { feed } = makeRig()
  feed(15, 40)
  assert.equal(feed(14).repCount, 0)
  assert.equal(feed(16).state, 'DOWN')
})

test('CASO 2: elevacion parcial no aumenta el contador', () => {
  const { feed } = makeRig()
  feed(15, 30)
  feed(45, 10)
  feed(60, 15)
  assert.equal(feed(60).repCount, 0)
  assert.equal(feed(60).state, 'RAISING')
})

test('CASO 3: elevacion completa suma 1', () => {
  const { feed } = makeRig()
  feed(15, 30)
  feed(45, 5)
  feed(85, 12)
  assert.equal(feed(85, 5).state, 'RAISED')
  assert.equal(feed(65, 8).repCount, 0)
  assert.equal(feed(12, 10).repCount, 1)
})

test('CASO 4: mantener los brazos en T no sigue aumentando', () => {
  const { feed } = makeRig()
  feed(15, 30)
  feed(45, 5)
  feed(85, 5)
  feed(85, 200)
  assert.equal(feed(85, 10).repCount, 0)
})

test('CASO 5: varios ciclos suman una repeticion por ciclo', () => {
  const { feed } = makeRig()
  feed(15, 30)
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    feed(45, 5)
    feed(85, 8)
    feed(65, 6)
    feed(12, 6)
    assert.equal(feed(15).repCount, cycle, `ciclo ${cycle}`)
  }
})

test('CASO 6: perder la pose no deja el contador en un ciclo invalido', () => {
  const { feed } = makeRig()
  feed(15, 30)
  feed(45, 5)
  feed(85, 6)
  const lost = feed(null, 40, { visible: false })
  assert.equal(lost.state, 'IDLE')
  feed(15, 10)
  feed(45, 5)
  feed(85, 8)
  feed(65, 6)
  assert.equal(feed(12, 8).repCount, 1)
})

test('CASO 7: no bajar hasta la posicion inicial no cuenta', () => {
  const { feed } = makeRig()
  feed(15, 30)
  feed(45, 5)
  feed(85, 8)
  feed(65, 6)
  assert.equal(feed(50, 10).repCount, 0)
  assert.equal(feed(50, 1).state, 'LOWERING')
})

test('CASO 8: subir de nuevo sin haber bajado no cuenta', () => {
  const { feed } = makeRig()
  feed(15, 30)
  feed(60, 3)
  feed(15, 15)
  assert.equal(feed(14).repCount, 0)
})

test('reset deja el contador en cero', () => {
  const { analyzer, feed } = makeRig()
  feed(15, 30)
  feed(45, 5)
  feed(85, 8)
  feed(65, 6)
  feed(12, 8)
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