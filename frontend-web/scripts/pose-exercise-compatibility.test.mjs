import assert from 'node:assert/strict'
import { AVAILABLE_EXERCISES } from '../src/data/exercises.js'
import {
  createAnalyzerForExercise,
  EXERCISE_REGISTRY,
  POSE_SUPPORTED_EXERCISE_IDS,
} from '../src/lib/exerciseRegistry.js'

const availableIds = AVAILABLE_EXERCISES.map(({ id }) => id)

assert.deepEqual([...availableIds].sort(), [...POSE_SUPPORTED_EXERCISE_IDS].sort())
assert.equal(availableIds.length, 8)

for (const exercise of AVAILABLE_EXERCISES) {
  const registryEntry = EXERCISE_REGISTRY.find(({ id }) => id === exercise.id)
  const analyzer = createAnalyzerForExercise(exercise.id)

  assert.equal(registryEntry?.estado, 'implementado', `${exercise.id} must be implemented`)
  assert.equal(typeof analyzer?.update, 'function', `${exercise.id} must provide update()`)
}

assert.equal(availableIds.includes('pushup_knees'), false)

console.log(`ok   ${availableIds.length} ejercicios expuestos tienen analizador compatible`)
