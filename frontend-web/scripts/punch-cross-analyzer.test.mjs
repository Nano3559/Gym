import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAnalyzerForExercise } from '../src/lib/exerciseRegistry.js'

function rig() {
  const analyzer = createAnalyzerForExercise('punch_cross')
  let now = 0
  function feed(angle, frames = 12, interval = 33, visible = true) {
    let state
    for (let i = 0; i < frames; i++) {
      const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: visible ? 1 : 0 }))
      for (const side of [0, 1]) {
        const radians = (180 - angle) * Math.PI / 180
        points[11 + side] = { x: 0.2, y: 0.5, visibility: visible ? 1 : 0 }
        points[13 + side] = { x: 0.5, y: 0.5, visibility: visible ? 1 : 0 }
        points[15 + side] = { x: 0.5 + 0.3 * Math.cos(radians), y: 0.5 + 0.3 * Math.sin(radians), visibility: visible ? 1 : 0 }
      }
      now += interval
      state = analyzer.processFrame(points, now)
    }
    return state
  }
  return { analyzer, feed }
}

test('boxeo: guardia → extensión → guardia suma una repetición con suavizado real', () => {
  const { feed } = rig()
  assert.equal(feed(90).repCount, 0)
  assert.equal(feed(180).repCount, 0)
  assert.equal(feed(90).repCount, 1)
  assert.equal(feed(90, 30).repCount, 1)
})

test('boxeo: varios ciclos completos suman uno por ciclo', () => {
  const { feed } = rig()
  feed(85)
  for (let expected = 1; expected <= 3; expected++) {
    feed(175)
    assert.equal(feed(85).repCount, expected)
  }
})

test('boxeo: extensión parcial no cuenta', () => {
  const { feed } = rig()
  feed(85)
  feed(140)
  assert.equal(feed(85).repCount, 0)
})

test('boxeo: mantener el brazo extendido no suma', () => {
  const { feed } = rig()
  feed(85)
  assert.equal(feed(175, 60).repCount, 0)
  assert.equal(feed(85).repCount, 1)
})

test('boxeo: comenzar extendido no cuenta un ciclo sin guardia inicial', () => {
  const { feed } = rig()
  feed(175)
  assert.equal(feed(85).repCount, 0)
  feed(175)
  assert.equal(feed(85).repCount, 1)
})

test('boxeo: movimiento demasiado rápido se rechaza', () => {
  const { feed } = rig()
  feed(85, 4, 1)
  feed(175, 4, 1)
  assert.equal(feed(85, 4, 1).repCount, 0)
})

test('boxeo: perder la pose más de la tolerancia invalida ese ciclo', () => {
  const { feed } = rig()
  feed(85)
  feed(175)
  assert.equal(feed(175, 30, 33, false).postureState, 'IDLE')
  assert.equal(feed(85).repCount, 0)
  feed(175)
  assert.equal(feed(85).repCount, 1)
})

test('boxeo: pequeños movimientos en guardia no cuentan y reiniciar limpia el contador', () => {
  const { analyzer, feed } = rig()
  for (const angle of [85, 92, 87, 94, 88]) assert.equal(feed(angle).repCount, 0)
  feed(85)
  feed(175)
  assert.equal(feed(85).repCount, 1)
  analyzer.reset()
  assert.equal(feed(85).repCount, 0)
})
