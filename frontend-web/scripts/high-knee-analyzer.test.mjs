// Pruebas de la maquina de estados de rodillas arriba (high knees). Se ejecutan
// con:
//   node scripts/high-knee-analyzer.test.mjs
//
// Entradas: coordenadas Y de rodillas y caderas. y crece hacia abajo, por lo
// que una rodilla arriba (a la altura de la cadera) tiene Y menor o igual.

import assert from 'node:assert/strict'
import { createHighKneeAnalyzer } from '../src/lib/highKneeAnalyzer.js'

const FRAME_MS = 33
const HIP_Y = 0.5
const DOWN = 0.72
const UP = 0.48
const NEAR = 0.52

function makeRig() {
  const state = { leftKnee: DOWN, rightKnee: DOWN, visible: true, time: 0 }

  const feed = (leftKnee, rightKnee, frames = 1, { visible = true } = {}) => {
    let snapshot
    for (let i = 0; i < frames; i += 1) {
      state.leftKnee = leftKnee
      state.rightKnee = rightKnee
      state.visible = visible
      state.time += FRAME_MS
      snapshot = analyzer.update({
        leftKneeY: visible ? leftKnee : null,
        rightKneeY: visible ? rightKnee : null,
        leftHipY: HIP_Y,
        rightHipY: HIP_Y,
        visibility: visible ? 1 : 0,
        timestamp: state.time,
      })
    }
    return snapshot
  }

  const analyzer = createHighKneeAnalyzer()
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

test('CASO 1: rodillas abajo estables no aumentan el contador', () => {
  const { feed } = makeRig()
  feed(DOWN, DOWN, 40)
  assert.equal(feed(DOWN, DOWN).repCount, 0)
  assert.equal(feed(DOWN, DOWN).state, 'LOW')
})

test('CASO 2: subir una rodilla a la cadera cuenta 1', () => {
  const { feed } = makeRig()
  feed(DOWN, DOWN, 30)
  feed(UP, DOWN, 20)
  assert.equal(feed(UP, DOWN).repCount, 1)
  assert.equal(feed(UP, DOWN).state, 'UP')
})

test('CASO 3: subir y bajar ambas piernas cuenta cada elevacion', () => {
  const { feed } = makeRig()
  feed(DOWN, DOWN, 30)
  feed(UP, DOWN, 5)
  assert.equal(feed(UP, DOWN).repCount, 1)
  feed(UP, UP, 10)
  assert.equal(feed(UP, UP).repCount, 2)
  feed(DOWN, DOWN, 10)
  feed(UP, DOWN, 5)
  assert.equal(feed(UP, DOWN).repCount, 3)
})

test('CASO 4: quedarse con la rodilla a la altura no vuelve a contar', () => {
  const { feed } = makeRig()
  feed(DOWN, DOWN, 30)
  feed(UP, DOWN, 5)
  feed(NEAR, DOWN, 10)
  feed(0.5, DOWN, 8)
  assert.equal(feed(0.5, DOWN).repCount, 1)
})

test('CASO 5: alternar piernas suma una repeticion por elevacion', () => {
  const { feed } = makeRig()
  feed(DOWN, DOWN, 30)
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    feed(UP, DOWN, 3)
    feed(0.7, DOWN, 4)
    assert.equal(feed(0.7, DOWN).repCount, cycle, `ciclo ${cycle}`)
  }
  feed(DOWN, UP, 3)
  assert.equal(feed(DOWN, UP).repCount, 6)
})

test('CASO 6: perder la pose no deja el contador en un ciclo invalido', () => {
  const { feed } = makeRig()
  feed(DOWN, DOWN, 30)
  feed(UP, DOWN, 3)
  assert.equal(feed(UP, DOWN).repCount, 1)
  const lost = feed(null, null, 40, { visible: false })
  assert.equal(lost.state, 'IDLE')
  feed(DOWN, DOWN, 10)
  feed(UP, DOWN, 5)
  assert.equal(feed(UP, DOWN).repCount, 2)
})

test('CASO 7: rodilla que no llega a la cadera no cuenta', () => {
  const { feed } = makeRig()
  feed(0.53, 0.53, 30)
  assert.equal(feed(0.53, 0.53).repCount, 0)
  assert.equal(feed(0.53, 0.53).state, 'LOW')
})

test('reset deja el contador en cero', () => {
  const { analyzer, feed } = makeRig()
  feed(DOWN, DOWN, 30)
  feed(UP, DOWN, 5)
  feed(DOWN, DOWN, 5)
  feed(DOWN, UP, 5)
  assert.equal(analyzer.snapshot().repCount, 2)
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