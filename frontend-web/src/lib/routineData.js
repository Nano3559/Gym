export function normalizeRoutineExercises(routine) {
  return (routine.exercises ?? routine.routine_exercises ?? routine.ejercicios ?? [])
    .slice().sort((a,b) => (a.order_index ?? a.orderIndex ?? 0) - (b.order_index ?? b.orderIndex ?? 0))
    .map(ex => ({ exerciseId: ex.exerciseId ?? ex.exercise_id, sets: ex.sets ?? 1,
      targetReps: ex.targetReps ?? ex.target_reps ?? 0,
      targetDuration: ex.targetDuration ?? ex.target_duration_sec ?? 0,
      restDuration: ex.restDuration ?? ex.rest_duration_sec ?? 60 }))
}
