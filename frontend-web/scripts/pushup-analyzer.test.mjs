// Pruebas de la maquina de estados de flexiones. Se ejecutan con:
//   node scripts/pushup-analyzer.test.mjs
// Cubren los mismos casos de aceptacion que el contador de sentadillas.

import assert from 'node:assert/strict'
import { createPushupAnalyzer } from '../src/lib/pushupAnalyzer.js'

const FRAME_MS = 33

function makeRig() {
  const state = { angle: 172, bodyOk: true, visible: true, time: 0 }

  const feed = (angle, frames = 1, { bodyOk = true, visible = true } = {}) => {
    let snapshot
    for (let i = 0; i < frames; i += 1) {
      state.angle = angle
      state.bodyOk = bodyOk
      state.visible = visible
      state.time += FRAME_MS
      snapshot = analyzer.update({
        elbowAngle: visible ? angle : null,
        bodyAngle: bodyOk ? 175 : 125,
        shoulder: { x: 0.3, y: 0.5, visibility: visible ? 1 : 0 },
        elbow: { x: 0.5, y: 0.5, visibility: visible ? 1 : 0 },
        wrist: { x: 0.7, y: 0.5, visibility: visible ? 1 : 0 },
        visibility: visible ? 1 : 0,
        timestamp: state.time,
      })
    }
    return snapshot
  }

  const analyzer = createPushupAnalyzer()
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

test('CASO 1: persona arriba con brazos extendidos no aumenta el contador', () => {
  const { feed } = makeRig()
  feed(172, 40)
  assert.equal(feed(170).repCount, 0)
  assert.equal(feed(174).state, 'TOP')
})

test('CASO 2: descenso parcial no aumenta el contador', () => {
  const { feed } = makeRig()
  feed(170, 30)
  feed(140, 10)
  feed(130, 15)
  assert.equal(feed(128).repCount, 0)
  assert.equal(feed(128).state, 'DESCENDING')
})

test('CASO 3: flexión completa suma 1', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(145, 5)
  feed(88, 12)
  assert.equal(feed(88, 5).state, 'BOTTOM')
  assert.equal(feed(130, 8).repCount, 0)
  assert.equal(feed(168, 10).repCount, 1)
})

test('CASO 4: permanecer abajo no sigue aumentando', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(140, 5)
  feed(85, 5)
  feed(92, 200)
  assert.equal(feed(92, 10).repCount, 0)
})

test('CASO 5: varios ciclos suman una repeticion por ciclo', () => {
  const { feed } = makeRig()
  feed(172, 30)
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    feed(145, 5)
    feed(88, 8)
    feed(135, 6)
    feed(170, 6)
    assert.equal(feed(172).repCount, cycle, `ciclo ${cycle}`)
  }
})

test('CASO 6: perder la pose no deja el contador en un ciclo invalido', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(140, 5)
  feed(88, 6)
  const lost = feed(null, 40, { visible: false })
  assert.equal(lost.state, 'IDLE')
  feed(172, 10)
  feed(145, 5)
  feed(88, 8)
  feed(135, 6)
  assert.equal(feed(170, 8).repCount, 1)
})

test('CASO 7: extension insuficiente de los brazos no cuenta', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(145, 5)
  feed(88, 1)
  feed(140, 4)
  assert.equal(feed(170, 10).repCount, 0)
})

test('CASO 8: subir sin haber bajado no cuenta', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(120, 3)
  feed(172, 15)
  assert.equal(feed(170).repCount, 0)
})

test('CASO 9: caderas caídas (cuerpo no recto) no cuenta', () => {
  const { feed } = makeRig()
  feed(172, 30)
  feed(145, 5)
  feed(88, 8, { bodyOk: false })
  feed(140, 6, { bodyOk: false })
  assert.equal(feed(170, 10, { bodyOk: false }).repCount, 0)
})

test('reset deja el contador en cero', () => {
  const { analyzer, feed } = makeRig()
  feed(172, 30)
  feed(145, 5)
  feed(88, 8)
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