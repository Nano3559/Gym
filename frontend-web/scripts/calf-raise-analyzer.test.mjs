// Pruebas de la maquina de estados de elevación de pantorrillas. Se ejecutan
// con:
//   node scripts/calf-raise-analyzer.test.mjs
//
// La entrada es el desplazamiento vertical de los hombros (y aumenta hacia
// abajo, por lo que subir = reducir el valor). heightRef normaliza el umbral.

import assert from 'node:assert/strict'
import { createCalfRaiseAnalyzer } from '../src/lib/calfRaiseAnalyzer.js'

const FRAME_MS = 33
const HEIGHT_REF = 0.3
// subida requerida = max(0.012, 0.06 * 0.3) = 0.018
const DOWN_Y = 0.4
const UP_Y = 0.375

function makeRig() {
  const state = { y: DOWN_Y, visible: true, time: 0 }

  const feed = (y, frames = 1, { visible = true } = {}) => {
    let snapshot
    for (let i = 0; i < frames; i += 1) {
      state.y = y
      state.visible = visible
      state.time += FRAME_MS
      snapshot = analyzer.update({
        shoulderY: visible ? y : null,
        heightRef: HEIGHT_REF,
        visibility: visible ? 1 : 0,
        timestamp: state.time,
      })
    }
    return snapshot
  }

  const analyzer = createCalfRaiseAnalyzer()
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

test('CASO 1: de pie estable no aumenta el contador', () => {
  const { feed } = makeRig()
  feed(DOWN_Y, 40)
  assert.equal(feed(DOWN_Y).repCount, 0)
  assert.equal(feed(DOWN_Y).state, 'DOWN')
})

test('CASO 2: elevacion parcial no aumenta el contador', () => {
  const { feed } = makeRig()
  feed(DOWN_Y, 30)
  feed(0.39, 10)
  assert.equal(feed(0.39).repCount, 0)
  assert.equal(feed(0.39).state, 'DOWN')
})

test('CASO 3: elevacion completa suma 1', () => {
  const { feed } = makeRig()
  feed(DOWN_Y, 30)
  feed(UP_Y, 12)
  assert.equal(feed(UP_Y, 5).state, 'RAISED')
  assert.equal(feed(0.398, 10).repCount, 1)
})

test('CASO 4: mantener la elevacion no sigue aumentando', () => {
  const { feed } = makeRig()
  feed(DOWN_Y, 30)
  feed(UP_Y, 12)
  feed(UP_Y, 200)
  assert.equal(feed(UP_Y, 10).repCount, 0)
})

test('CASO 5: varios ciclos suman una repeticion por ciclo', () => {
  const { feed } = makeRig()
  feed(DOWN_Y, 30)
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    feed(UP_Y, 8)
    feed(0.392, 6)
    feed(0.399, 6)
    feed(DOWN_Y, 5)
    assert.equal(feed(DOWN_Y).repCount, cycle, `ciclo ${cycle}`)
  }
})

test('CASO 6: perder la pose no deja el contador en un ciclo invalido', () => {
  const { feed } = makeRig()
  feed(DOWN_Y, 30)
  feed(UP_Y, 6)
  const lost = feed(null, 40, { visible: false })
  assert.equal(lost.state, 'IDLE')
  feed(DOWN_Y, 10)
  feed(UP_Y, 8)
  feed(0.392, 6)
  assert.equal(feed(0.399, 8).repCount, 1)
})

test('CASO 7: subir de nuevo sin completar la bajada no cuenta', () => {
  const { feed } = makeRig()
  feed(DOWN_Y, 30)
  feed(UP_Y, 12)
  feed(0.392, 10)
  feed(UP_Y, 8)
  assert.equal(feed(UP_Y).repCount, 0)
  assert.equal(feed(UP_Y).state, 'RAISED')
})

test('CASO 8: elevaciones minúsculas repetidas no cuentan', () => {
  const { feed } = makeRig()
  feed(0.392, 40)
  assert.equal(feed(0.392).repCount, 0)
  assert.equal(feed(0.392).state, 'DOWN')
})

test('reset deja el contador en cero', () => {
  const { analyzer, feed } = makeRig()
  feed(DOWN_Y, 30)
  feed(UP_Y, 8)
  feed(0.392, 6)
  feed(0.399, 8)
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