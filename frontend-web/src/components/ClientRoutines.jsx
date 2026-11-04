import { useState, useCallback, useEffect } from 'react'
import {
  Play,
  Dumbbell,
  Clock,
  Calendar,
  ChevronRight,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { DEFAULT_ROUTINES } from '../data/defaultRoutines.js'
import { getExerciseById } from '../lib/exerciseRegistry.js'
import RoutineRunner from './RoutineRunner.jsx'
import { useRoutine } from '../context/RoutineContext.jsx'
import { normalizeRoutineExercises } from '../lib/routineData.js'
import { getUserRoutineHistory } from '../services/routineService.js'

export default function ClientRoutines({ onClose, onNotify }) {
  const { startRoutine } = useRoutine()
  const [history, setHistory] = useState([])
  const [assignedRoutines, setAssignedRoutines] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeRoutine, setActiveRoutine] = useState(null)
  const [expandedRoutine, setExpandedRoutine] = useState(null)

  const loadAssignedRoutines = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: assignments, error } = await supabase
        .from('routine_assignments')
        .select('*, routine:routines(*, routine_exercises(*))')
        .eq('client_id', user.id)
        .eq('active', true)
        .order('assigned_at', { ascending: false })

      if (error) throw error
      setAssignedRoutines(assignments ?? [])
      setHistory(await getUserRoutineHistory())
    } catch {
      onNotify?.('Error al cargar rutinas', 'error')
    } finally {
      setLoading(false)
    }
  }, [onNotify])

  useEffect(() => {
    loadAssignedRoutines()
  }, [loadAssignedRoutines])

  const handleStartRoutine = (routine) => {
    const exercises = normalizeRoutineExercises(routine)
    if (!exercises.length) return onNotify?.('La rutina no tiene ejercicios.', 'error')
    startRoutine(exercises, { routineId: routine.ejercicios ? null : routine.id,
      routineTitle: routine.title ?? routine.nombre })
    setActiveRoutine(routine)
  }

  const handleCloseRunner = () => {
    setActiveRoutine(null)
    loadAssignedRoutines()
  }

  const getRoutineExercises = (routine) => {
    return normalizeRoutineExercises(routine)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Mis rutinas</h2>
            <p className="text-sm text-muted">Rutinas asignadas y predeterminadas</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-muted transition hover:border-accent/50 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-2xl border border-line p-4">
                <h3 className="font-bold">Historial de entrenamiento</h3>
                {!history.length && <p className="mt-2 text-sm text-muted">Todavía no hay sesiones completadas.</p>}
                {history.map(session => <p key={session.id} className="mt-2 text-sm text-muted">{session.routine_title} · {new Date(session.completed_at).toLocaleDateString('es-BO')} · {Math.round(session.duration_sec / 60)} min</p>)}
              </section>
              {assignedRoutines.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted">
                    <User className="h-4 w-4" />
                    Asignadas por tu entrenador
                  </h3>
                  <div className="space-y-3">
                    {assignedRoutines.map((assignment) => {
                      const routine = assignment.routine
                      if (!routine) return null
                      const exercises = getRoutineExercises(routine)
                      const isExpanded = expandedRoutine === assignment.id
                      return (
                        <div
                          key={assignment.id}
                          className="rounded-2xl border border-line bg-gray-800"
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-display text-lg font-bold text-white">
                                  {routine.title}
                                </h4>
                                {routine.description && (
                                  <p className="mt-1 text-sm text-muted">{routine.description}</p>
                                )}
                                <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                                  <span className="flex items-center gap-1">
                                    <Dumbbell className="h-3.5 w-3.5" />
                                    {exercises.length} ejercicios
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {new Date(assignment.assigned_at).toLocaleDateString('es-ES')}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleStartRoutine(routine)}
                                className="flex h-12 items-center gap-2 rounded-xl bg-accent px-5 font-bold text-white transition hover:bg-accent-hover"
                              >
                                <Play className="h-5 w-5" />
                                Iniciar
                              </button>
                            </div>

                            <button
                              onClick={() =>
                                setExpandedRoutine(isExpanded ? null : assignment.id)
                              }
                              className="mt-3 flex items-center gap-1 text-sm text-accent transition hover:text-accent-hover"
                            >
                              {isExpanded ? 'Ocultar ejercicios' : 'Ver ejercicios'}
                              <ChevronRight
                                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              />
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-line p-4">
                              <div className="space-y-2">
                                {exercises.map((ex, idx) => {
                                  const meta = getExerciseById(ex.exerciseId)
                                  return (
                                    <div
                                      key={`${ex.exerciseId}-${idx}`}
                                      className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20 text-sm font-bold text-accent">
                                          {idx + 1}
                                        </span>
                                        <p className="text-sm font-semibold text-white">
                                          {meta?.nombre ?? ex.exerciseId}
                                        </p>
                                      </div>
                                      <span className="text-xs text-muted">
                                        {ex.sets} × {ex.targetReps ? `${ex.targetReps} reps` : `${ex.targetDuration}s`}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted">
                  <Sparkles className="h-4 w-4" />
                  Rutinas predeterminadas
                </h3>
                <div className="space-y-3">
                  {DEFAULT_ROUTINES.map((routine) => {
                    const isExpanded = expandedRoutine === routine.id
                    return (
                      <div
                        key={routine.id}
                        className="rounded-2xl border border-line bg-gray-800"
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-display text-lg font-bold text-white">
                                {routine.nombre}
                              </h4>
                              <p className="mt-1 text-sm text-muted">{routine.descripcion}</p>
                              <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                                <span className="flex items-center gap-1">
                                  <Dumbbell className="h-3.5 w-3.5" />
                                  {routine.ejercicios.length} ejercicios
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  ~{Math.round(
                                    routine.ejercicios.reduce(
                                      (sum, ex) =>
                                        sum + ex.sets * (ex.targetDuration || ex.targetReps * 3 + ex.restDuration),
                                      0,
                                    ) / 60,
                                  )} min
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleStartRoutine(routine)}
                              className="flex h-12 items-center gap-2 rounded-xl bg-accent px-5 font-bold text-white transition hover:bg-accent-hover"
                            >
                              <Play className="h-5 w-5" />
                              Iniciar
                            </button>
                          </div>

                          <button
                            onClick={() => setExpandedRoutine(isExpanded ? null : routine.id)}
                            className="mt-3 flex items-center gap-1 text-sm text-accent transition hover:text-accent-hover"
                          >
                            {isExpanded ? 'Ocultar ejercicios' : 'Ver ejercicios'}
                            <ChevronRight
                              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-line p-4">
                            <div className="space-y-2">
                              {routine.ejercicios.map((ex, idx) => {
                                const meta = getExerciseById(ex.exerciseId)
                                return (
                                  <div
                                    key={`${ex.exerciseId}-${idx}`}
                                    className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20 text-sm font-bold text-accent">
                                        {idx + 1}
                                      </span>
                                      <p className="text-sm font-semibold text-white">
                                        {meta?.nombre ?? ex.exerciseId}
                                      </p>
                                    </div>
                                    <span className="text-xs text-muted">
                                      {ex.sets} × {ex.targetReps ? `${ex.targetReps} reps` : `${ex.targetDuration}s`}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeRoutine && (
        <RoutineRunner
          routine={activeRoutine}
          onClose={handleCloseRunner}
        />
      )}
    </div>
  )
}
