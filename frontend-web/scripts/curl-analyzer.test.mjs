// Pruebas de la maquina de estados de curl de biceps. Se ejecutan con:
//   node scripts/curl-analyzer.test.mjs
// Cubren los mismos casos de aceptacion que el contador de sentadillas.

import assert from 'node:assert/strict'
import { createCurlAnalyzer } from '../src/lib/curlAnalyzer.js'

const FRAME_MS = 33

function makeRig() {
  const state = { angle: 160, visible: true, time: 0 }

  const feed = (angle, frames = 1, { visible = true } = {}) => {
    let snapshot
    for (let i = 0; i < frames; i += 1) {
      state.angle = angle
      state.visible = visible
      state.time += FRAME_MS
      snapshot = analyzer.update({
        elbowAngle: visible ? angle : null,
        shoulder: { x: 0.3, y: 0.3, visibility: visible ? 1 : 0 },
        elbow: { x: 0.4, y: 0.4, visibility: visible ? 1 : 0 },
        wrist: { x: 0.5, y: 0.6, visibility: visible ? 1 : 0 },
        visibility: visible ? 1 : 0,
        timestamp: state.time,
      })
    }
    return snapshot
  }

  const analyzer = createCurlAnalyzer()
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

test('CASO 1: brazo extendido estable no aumenta el contador', () => {
  const { feed } = makeRig()
  feed(160, 40)
  assert.equal(feed(158).repCount, 0)
  assert.equal(feed(162).state, 'EXTENDED')
})

test('CASO 2: flexion parcial no aumenta el contador', () => {
  const { feed } = makeRig()
  feed(160, 30)
  feed(130, 10)
  feed(120, 15)
  assert.equal(feed(120).repCount, 0)
  assert.equal(feed(120).state, 'FLEXING')
})

test('CASO 3: curl completo suma 1', () => {
  const { feed } = makeRig()
  feed(160, 30)
  feed(140, 5)
  feed(30, 12)
  assert.equal(feed(30, 5).state, 'FLEXED')
  assert.equal(feed(60, 8).repCount, 0)
  assert.equal(feed(162, 10).repCount, 1)
})

test('CASO 4: mantener la contraccion no sigue aumentando', () => {
  const { feed } = makeRig()
  feed(160, 30)
  feed(140, 5)
  feed(32, 5)
  feed(32, 200)
  assert.equal(feed(32, 10).repCount, 0)
})

test('CASO 5: varios ciclos suman una repeticion por ciclo', () => {
  const { feed } = makeRig()
  feed(160, 30)
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    feed(140, 5)
    feed(30, 8)
    feed(60, 6)
    feed(162, 6)
    assert.equal(feed(160).repCount, cycle, `ciclo ${cycle}`)
  }
})

test('CASO 6: perder la pose no deja el contador en un ciclo invalido', () => {
  const { feed } = makeRig()
  feed(160, 30)
  feed(140, 5)
  feed(30, 6)
  const lost = feed(null, 40, { visible: false })
  assert.equal(lost.state, 'IDLE')
  feed(160, 10)
  feed(140, 5)
  feed(30, 8)
  feed(60, 6)
  assert.equal(feed(162, 8).repCount, 1)
})

test('CASO 7: no volver a estirar el brazo no cuenta', () => {
  const { feed } = makeRig()
  feed(160, 30)
  feed(140, 5)
  feed(32, 1)
  feed(60, 4)
  assert.equal(feed(162, 10).repCount, 0)
})

test('CASO 8: flexionar sin haber estirado no cuenta', () => {
  const { feed } = makeRig()
  feed(160, 30)
  feed(110, 3)
  feed(162, 15)
  assert.equal(feed(160).repCount, 0)
})

test('reset deja el contador en cero', () => {
  const { analyzer, feed } = makeRig()
  feed(160, 30)
  feed(140, 5)
  feed(30, 8)
  feed(60, 6)
  feed(162, 8)
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