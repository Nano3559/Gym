import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { EXERCISE_REGISTRY, createAnalyzerForExercise } from '../src/lib/exerciseRegistry.js'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(() => server.close())
const { default: Counter } = await server.ssrLoadModule('/src/components/ExerciseCounter.jsx')
const render = (exercise, poseState) => renderToStaticMarkup(React.createElement(Counter, { exercise, poseState }))
const value = html => html.match(/aria-live="polite">([^<]+)</)[1]

for (const exercise of EXERCISE_REGISTRY.filter(item => item.tipo === 'tiempo')) {
  test(`contador temporal: ${exercise.id} muestra segundos, no repeticiones`, () => {
    const html = render(exercise, { repCount: 99, holdSeconds: 12.75, holdSecondsLeft: 12.75, holdSecondsRight: 20 })
    assert.equal(value(html), '12')
    assert.ok(html.includes('Segundos acumulados en postura válida'))
    assert.ok(!html.includes('Segundos restantes'))
    if (exercise.unilateral) {
      assert.ok(html.includes('Izquierdo: 12 s'))
      assert.ok(html.includes('Derecho: 20 s'))
      assert.ok(html.includes('lado con menos tiempo'))
    }
  })
}

test('plancha: avanza con postura válida, conserva tiempo al perderla y reinicia', () => {
  const exercise = EXERCISE_REGISTRY.find(item => item.id === 'plank')
  const analyzer = createAnalyzerForExercise(exercise.id)
  const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
  Object.assign(pose[11], { x: 0.2, y: 0.3 })
  Object.assign(pose[23], { x: 0.5, y: 0.3 })
  Object.assign(pose[27], { x: 0.8, y: 0.3 })
  let state
  for (let t = 0; t <= 2000; t += 100) state = analyzer.processFrame(pose, t)
  assert.equal(state.repCount, 0)
  assert.equal(value(render(exercise, state)), '2')
  state = analyzer.processFrame([], 2100)
  assert.equal(state.isTimerRunning, false)
  assert.equal(value(render(exercise, state)), '2')
  for (let t = 2200; t <= 3300; t += 100) state = analyzer.processFrame(pose, t)
  assert.equal(value(render(exercise, state)), '3')
  analyzer.reset()
  assert.equal(value(render(exercise, analyzer.processFrame([], 3400))), '0')
})

test('ejercicios por repeticiones conservan su contador', () => {
  for (const exercise of EXERCISE_REGISTRY.filter(item => item.tipo === 'reps')) {
    const html = render(exercise, { repCount: 7, holdSeconds: 21 })
    assert.equal(value(html), '7', exercise.id)
    assert.ok(html.includes('Repeticiones válidas'))
  }
})

test('unilateral: expone progreso aunque el total combinado todavía sea cero', () => {
  const exercise = EXERCISE_REGISTRY.find(item => item.id === 'bal_single_leg')
  const html = render(exercise, { repCount: 0, holdSeconds: 0, holdSecondsLeft: 8, holdSecondsRight: 0 })
  assert.equal(value(html), '0')
  assert.ok(html.includes('Izquierdo: 8 s'))
  assert.ok(html.includes('Derecho: 0 s'))
})

test('sin medición temporal inicial muestra cero y no NaN', () => {
  const exercise = EXERCISE_REGISTRY.find(item => item.id === 'plank')
  for (const holdSeconds of [undefined, null, NaN, -1]) {
    assert.equal(value(render(exercise, { repCount: 0, holdSeconds })), '0')
  }
})
