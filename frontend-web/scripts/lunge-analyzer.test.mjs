// Pruebas de la maquina de estados de zancadas (lunges). Se ejecutan con:
//   node scripts/lunge-analyzer.test.mjs

import assert from 'node:assert/strict'
import { createLungeAnalyzer } from '../src/lib/lungeAnalyzer.js'

const FRAME_MS = 33

function makeRig() {
  const state = { front: 175, back: 175, frontY: 0.42, backY: 0.42, visible: true, time: 0 }

  const feed = (front, back, frames = 1, { frontY, backY, visible = true } = {}) => {
    let snapshot
    for (let i = 0; i < frames; i += 1) {
      state.front = front
      state.back = back
      state.frontY = frontY ?? 0.42
      state.backY = backY ?? 0.42
      state.visible = visible
      state.time += FRAME_MS
      snapshot = analyzer.update({
        frontKneeAngle: visible ? front : null,
        backKneeAngle: visible ? back : null,
        frontKneeY: visible ? state.frontY : null,
        backKneeY: visible ? state.backY : null,
        visibility: visible ? 1 : 0,
        timestamp: state.time,
      })
    }
    return snapshot
  }

  const analyzer = createLungeAnalyzer()
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
  feed(175, 175, 40)
  assert.equal(feed(175, 175).repCount, 0)
  assert.equal(feed(175, 175).state, 'STANDING')
})

test('CASO 2: descenso parcial no aumenta el contador', () => {
  const { feed } = makeRig()
  feed(175, 175, 30)
  feed(135, 130, 15, { frontY: 0.44, backY: 0.49 })
  assert.equal(feed(135, 130).repCount, 0)
  assert.equal(feed(135, 130).state, 'DESCENDING')
})

test('CASO 3: zancada completa suma 1', () => {
  const { feed } = makeRig()
  feed(175, 175, 30)
  feed(130, 120, 10, { frontY: 0.44, backY: 0.49 })
  feed(95, 105, 8, { frontY: 0.46, backY: 0.56 })
  feed(95, 105, 3, { frontY: 0.46, backY: 0.56 })
  assert.equal(feed(95, 105).state, 'BOTTOM')
  feed(145, 150, 8, { frontY: 0.44, backY: 0.5 })
  assert.equal(feed(172, 175, 8).repCount, 1)
})

test('CASO 4: permanecer en la posicion de zancada no sigue aumentando', () => {
  const { feed } = makeRig()
  feed(175, 175, 30)
  feed(130, 120, 5)
  feed(95, 105, 200, { frontY: 0.46, backY: 0.56 })
  assert.equal(feed(95, 105).repCount, 0)
})

test('CASO 5: varios ciclos suman una repeticion por ciclo', () => {
  const { feed } = makeRig()
  feed(175, 175, 30)
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    feed(130, 120, 5, { frontY: 0.44, backY: 0.49 })
    feed(95, 105, 8, { frontY: 0.46, backY: 0.56 })
    feed(95, 105, 2, { frontY: 0.46, backY: 0.56 })
    feed(145, 150, 6, { frontY: 0.44, backY: 0.5 })
    feed(172, 175, 6)
    assert.equal(feed(175, 175).repCount, cycle, `ciclo ${cycle}`)
  }
})

test('CASO 6: perder la pose no deja el contador en un ciclo invalido', () => {
  const { feed } = makeRig()
  feed(175, 175, 30)
  feed(130, 120, 5)
  feed(95, 105, 6, { frontY: 0.46, backY: 0.56 })
  const lost = feed(95, 105, 40, { visible: false })
  assert.equal(lost.state, 'IDLE')
  feed(175, 175, 10)
  feed(130, 120, 5)
  feed(95, 105, 8, { frontY: 0.46, backY: 0.56 })
  feed(145, 150, 6, { frontY: 0.44, backY: 0.5 })
  assert.equal(feed(172, 175, 8).repCount, 1)
})

test('CASO 7: rodilla delantera doblada sin bajar la trasera no cuenta', () => {
  const { feed } = makeRig()
  feed(175, 175, 30)
  feed(100, 175, 8, { frontY: 0.44, backY: 0.44 })
  feed(160, 170, 8, { frontY: 0.42, backY: 0.42 })
  feed(175, 175, 5)
  assert.equal(feed(175, 175).repCount, 0)
})

test('CASO 8: bajar sin haber estado de pie no cuenta', () => {
  const { feed } = makeRig()
  feed(130, 120, 30, { frontY: 0.44, backY: 0.49 })
  feed(95, 105, 15, { frontY: 0.46, backY: 0.56 })
  feed(172, 175, 15)
  assert.equal(feed(175, 175).repCount, 0)
})

test('CASO 9: rodilla trasera no baja (como sentadilla) no cuenta', () => {
  const { feed } = makeRig()
  feed(175, 175, 30)
  feed(105, 108, 10, { frontY: 0.46, backY: 0.47 })
  feed(105, 108, 3, { frontY: 0.46, backY: 0.47 })
  feed(145, 150, 8, { frontY: 0.42, backY: 0.43 })
  feed(172, 175, 5)
  assert.equal(feed(175, 175).repCount, 0)
})

test('reset deja el contador en cero', () => {
  const { analyzer, feed } = makeRig()
  feed(175, 175, 30)
  feed(130, 120, 5)
  feed(95, 105, 8, { frontY: 0.46, backY: 0.56 })
  feed(95, 105, 3, { frontY: 0.46, backY: 0.56 })
  feed(145, 150, 6, { frontY: 0.44, backY: 0.5 })
  feed(172, 175, 8)
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