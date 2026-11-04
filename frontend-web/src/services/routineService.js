import { supabase } from '../lib/supabase.js'

export async function saveRoutineSession({ routineId, routineTitle, exercises, durationSec, tracking, expectedUserId }) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuario no autenticado')
  if (expectedUserId && user.id !== expectedUserId) throw new Error('La cuenta cambió durante el entrenamiento.')

  const { data, error } = await supabase
    .from('routine_sessions')
    .upsert({
      user_id: user.id,
      routine_id: routineId ?? null,
      routine_title: routineTitle,
      exercises,
      duration_sec: durationSec,
      ...(tracking || {}),
    }, { onConflict: 'user_id,operation_id', ignoreDuplicates: true })

  if (error) throw error
  return data
}

export async function getUserRoutineHistory() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('routine_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data ?? []
}

export async function createRoutine({ title, description, exercises }) {
  const { data, error } = await supabase.rpc('create_training_routine', {
    p_title: title, p_description: description,
    p_exercises: exercises.map((ex, i) => ({ exercise_id: ex.exerciseId, sets: ex.sets,
      target_reps: ex.targetReps || null, target_duration_sec: ex.targetDuration || null,
      rest_duration_sec: ex.restDuration, order_index: i }))
  })
  if (error) throw error
  return data
}
