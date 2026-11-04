import { useState } from 'react'
import { Play, Clock, Repeat, Dumbbell, X } from 'lucide-react'
import { DEFAULT_ROUTINES } from '../data/defaultRoutines.js'
import { getExerciseById } from '../lib/exerciseRegistry.js'
import { useRoutine } from '../context/RoutineContext.jsx'

export default function DefaultRoutines({ onClose }) {
  const { startRoutine } = useRoutine()
  const [selectedId, setSelectedId] = useState(null)

  const selected = DEFAULT_ROUTINES.find((r) => r.id === selectedId)

  const handleStart = () => {
    if (!selected) return
    startRoutine(selected.ejercicios)
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-card">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Rutinas predeterminadas</h2>
            <p className="text-sm text-muted">Elige una rutina para comenzar</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-muted transition hover:border-accent/50 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {DEFAULT_ROUTINES.map((routine) => {
              const isSelected = selectedId === routine.id
              return (
                <button
                  key={routine.id}
                  onClick={() => setSelectedId(routine.id)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-line bg-gray-800 hover:border-volt/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-white">{routine.nombre}</h3>
                      <p className="mt-1 text-sm text-muted">{routine.descripcion}</p>
                    </div>
                    {isSelected && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent">
                        <Play className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Dumbbell className="h-3.5 w-3.5" />
                      {routine.ejercicios.length} ejercicios
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat className="h-3.5 w-3.5" />
                      {routine.ejercicios.reduce((sum, ex) => sum + (ex.sets ?? 1), 0)} series
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {selected && (
            <div className="mt-6 rounded-2xl border border-line bg-gray-800 p-5">
              <h3 className="font-display text-lg font-bold text-white">{selected.nombre}</h3>
              <p className="mt-1 text-sm text-muted">{selected.descripcion}</p>

              <div className="mt-4 space-y-2">
                {selected.ejercicios.map((ex, idx) => {
                  const meta = getExerciseById(ex.exerciseId)
                  return (
                    <div
                      key={`${ex.exerciseId}-${idx}`}
                      className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-sm font-bold text-accent">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white">{meta?.nombre ?? ex.exerciseId}</p>
                          <p className="text-xs text-muted">
                            {ex.sets} series · {ex.targetReps ? `${ex.targetReps} reps` : `${ex.targetDuration}s`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <Clock className="h-3.5 w-3.5" />
                        {ex.restDuration}s
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={handleStart}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent font-bold text-white transition hover:bg-accent-hover"
              >
                <Play className="h-5 w-5" />
                Iniciar rutina
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
