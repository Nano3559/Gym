import { useState, useCallback } from 'react'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  X,
  Clock,
  Repeat,
  Dumbbell,
} from 'lucide-react'
import { EXERCISE_REGISTRY, EXERCISE_CATEGORIES, searchExercises } from '../lib/exerciseRegistry.js'

export default function TrainerRoutineBuilder({ onSave, onClose }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [exercises, setExercises] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  const filteredExercises = searchExercises(searchQuery).filter(
    (ex) => !selectedCategory || ex.categoria === selectedCategory,
  )

  const addExercise = useCallback((exercise) => {
    setExercises((prev) => [
      ...prev,
      {
        exerciseId: exercise.id,
        sets: 3,
        targetReps: exercise.tipo === 'reps' ? 10 : 0,
        targetDuration: exercise.tipo === 'tiempo' ? 30 : 0,
        restDuration: 60,
      },
    ])
    setShowPicker(false)
    setSearchQuery('')
  }, [])

  const removeExercise = useCallback((index) => {
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateExercise = useCallback((index, field, value) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex)),
    )
  }, [])

  const moveExercise = useCallback((index, direction) => {
    setExercises((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }, [])

  const handleSave = async () => {
    if (!title.trim() || exercises.length === 0) return
    if (saving) return
    setSaving(true)
    setSaveError('')
    try {
    await onSave?.({
      title: title.trim(),
      description: description.trim(),
      exercises: exercises.map((ex, idx) => ({ ...ex, orderIndex: idx })),
    })
    } catch { setSaveError('No se pudo guardar la rutina. Revisa tu conexión y los permisos de entrenador.') }
    finally { setSaving(false) }
  }

  const totalDuration = exercises.reduce(
    (sum, ex) => sum + (ex.sets * (ex.targetDuration || ex.targetReps * 3 + ex.restDuration)),
    0,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Crear rutina</h2>
            <p className="text-sm text-muted">Diseña una rutina personalizada</p>
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
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Nombre de la rutina
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Rutina de fuerza"
                className="w-full rounded-xl border border-line bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Descripción (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el objetivo de la rutina..."
                rows={2}
                className="w-full resize-none rounded-xl border border-line bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">
                Ejercicios ({exercises.length})
              </h3>
              <button
                onClick={() => setShowPicker(true)}
                className="flex h-12 items-center gap-2 rounded-xl bg-accent px-4 font-bold text-white transition hover:bg-accent-hover"
              >
                <Plus className="h-5 w-5" />
                Añadir
              </button>
            </div>

            {exercises.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-8 text-center">
                <Dumbbell className="mx-auto mb-3 h-12 w-12 text-muted" />
                <p className="text-sm text-muted">
                  Añade ejercicios para comenzar a construir la rutina
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {exercises.map((ex, index) => {
                  const meta = EXERCISE_REGISTRY.find((e) => e.id === ex.exerciseId)
                  const isTimeBased = meta?.tipo === 'tiempo'
                  return (
                    <div
                      key={`${ex.exerciseId}-${index}`}
                      className="rounded-2xl border border-line bg-gray-800 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => moveExercise(index, -1)}
                            disabled={index === 0}
                            className="flex h-12 w-12 items-center justify-center rounded-lg border border-line text-muted transition hover:border-volt/50 hover:text-white disabled:opacity-30"
                            aria-label="Subir"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => moveExercise(index, 1)}
                            disabled={index === exercises.length - 1}
                            className="flex h-12 w-12 items-center justify-center rounded-lg border border-line text-muted transition hover:border-volt/50 hover:text-white disabled:opacity-30"
                            aria-label="Bajar"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-white">
                              {index + 1}. {meta?.nombre ?? ex.exerciseId}
                            </p>
                            <button
                              onClick={() => removeExercise(index)}
                              className="flex h-12 w-12 items-center justify-center rounded-lg border border-line text-muted transition hover:border-red-500/50 hover:text-red-400"
                              aria-label="Eliminar ejercicio"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div>
                              <label className="mb-1 block text-xs text-muted">Series</label>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={ex.sets}
                                onChange={(e) => updateExercise(index, 'sets', parseInt(e.target.value) || 1)}
                                className="w-full rounded-lg border border-line bg-gray-900 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                              />
                            </div>

                            {isTimeBased ? (
                              <div>
                                <label className="mb-1 block text-xs text-muted">Segundos</label>
                                <input
                                  type="number"
                                  min={5}
                                  max={300}
                                  value={ex.targetDuration}
                                  onChange={(e) => updateExercise(index, 'targetDuration', parseInt(e.target.value) || 0)}
                                  className="w-full rounded-lg border border-line bg-gray-900 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="mb-1 block text-xs text-muted">Reps</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={ex.targetReps}
                                  onChange={(e) => updateExercise(index, 'targetReps', parseInt(e.target.value) || 0)}
                                  className="w-full rounded-lg border border-line bg-gray-900 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                                />
                              </div>
                            )}

                            <div>
                              <label className="mb-1 block text-xs text-muted">Descanso (s)</label>
                              <input
                                type="number"
                                min={0}
                                max={300}
                                value={ex.restDuration}
                                onChange={(e) => updateExercise(index, 'restDuration', parseInt(e.target.value) || 0)}
                                className="w-full rounded-lg border border-line bg-gray-900 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                              />
                            </div>

                            <div className="flex items-end">
                              <div className="flex w-full items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs text-muted">
                                {isTimeBased ? (
                                  <>
                                    <Clock className="h-3.5 w-3.5" />
                                    {ex.sets} × {ex.targetDuration}s
                                  </>
                                ) : (
                                  <>
                                    <Repeat className="h-3.5 w-3.5" />
                                    {ex.sets} × {ex.targetReps} reps
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-line px-6 py-4">
          {saveError && <p role="alert" className="mb-3 text-sm text-red-300">{saveError}</p>}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted">
              {exercises.length} ejercicios · ~{Math.round(totalDuration / 60)} min
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="h-12 rounded-xl border border-line px-6 font-bold text-white transition hover:border-volt/50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || exercises.length === 0 || exercises.some(ex => ex.sets < 1 || (!ex.targetReps && !ex.targetDuration) || ex.restDuration < 0)}
                className="flex h-12 items-center gap-2 rounded-xl bg-accent px-6 font-bold text-white transition hover:bg-accent-hover disabled:opacity-40"
              >
                <Save className="h-5 w-5" />
                {saving ? 'Guardando...' : 'Guardar rutina'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-card">
            <div className="border-b border-line p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-white">Añadir ejercicio</h3>
                <button
                  onClick={() => setShowPicker(false)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-muted transition hover:border-accent/50 hover:text-white"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ejercicio..."
                className="mt-3 w-full rounded-xl border border-line bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-accent focus:outline-none"
                autoFocus
              />
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`min-h-12 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    !selectedCategory
                      ? 'bg-accent text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Todos
                </button>
                {Object.entries(EXERCISE_CATEGORIES).map(([key]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={`min-h-12 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedCategory === key
                        ? 'bg-accent text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {filteredExercises.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => addExercise(ex)}
                    className="flex items-center justify-between rounded-xl border border-line bg-gray-800 p-3 text-left transition hover:border-accent/50 hover:bg-gray-750"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{ex.nombre}</p>
                      <p className="text-xs text-muted">
                        {EXERCISE_CATEGORIES[ex.categoria]} · {ex.tipo === 'reps' ? 'Reps' : 'Tiempo'}
                      </p>
                    </div>
                    <Plus className="h-5 w-5 text-accent" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
