import { useState, useMemo } from 'react'
import {
  EXERCISE_REGISTRY,
  EXERCISE_CATEGORIES,
  searchExercises,
} from '../lib/exerciseRegistry.js'

const DIFFICULTIES = ['principiante', 'intermedio', 'avanzado']
const TYPES = ['reps', 'tiempo']

const MUSCLES = [
  'pecho',
  'hombros',
  'bíceps',
  'tríceps',
  'dorsales',
  'cuádriceps',
  'glúteos',
  'isquiotibiales',
  'abdominales',
  'oblicuos',
  'core',
  'pantorrillas',
  'trapecio',
  'lumbar',
  'aductores',
  'cadera',
  'cuerpo completo',
]

const DIFFICULTY_LABELS = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export function ExercisePicker({ onSelect }) {
  const [selectedCategory, setSelectedCategory] = useState('A')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('')
  const [selectedType, setSelectedType] = useState('')

  const filteredExercises = useMemo(() => {
    let results = searchExercises(searchQuery)

    if (searchQuery && !selectedCategory) {
      return results
    }

    if (selectedCategory) {
      results = results.filter((ex) => ex.categoria === selectedCategory)
    }

    if (selectedMuscle) {
      results = results.filter((ex) => ex.musculos.includes(selectedMuscle))
    }

    if (selectedDifficulty) {
      results = results.filter((ex) => ex.dificultad === selectedDifficulty)
    }

    if (selectedType) {
      results = results.filter((ex) => ex.tipo === selectedType)
    }

    return results
  }, [searchQuery, selectedCategory, selectedMuscle, selectedDifficulty, selectedType])

  const handleSelect = (exercise) => {
    if (onSelect) onSelect(exercise)
  }

  const clearFilters = () => {
    setSelectedMuscle('')
    setSelectedDifficulty('')
    setSelectedType('')
  }

  return (
    <div className="bg-gray-900 text-white p-4">
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar ejercicio..."
          className="w-full bg-gray-800 text-white placeholder-gray-400 rounded-lg px-4 py-3 text-base border border-gray-700 focus:border-orange-500 focus:outline-none"
          style={{ minHeight: '48px' }}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {Object.entries(EXERCISE_CATEGORIES).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === key
                ? 'bg-orange-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            style={{ minHeight: '40px' }}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={selectedMuscle}
          onChange={(e) => setSelectedMuscle(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-orange-500 focus:outline-none"
          style={{ minHeight: '40px' }}
        >
          <option value="">Músculo</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={selectedDifficulty}
          onChange={(e) => setSelectedDifficulty(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-orange-500 focus:outline-none"
          style={{ minHeight: '40px' }}
        >
          <option value="">Dificultad</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-orange-500 focus:outline-none"
          style={{ minHeight: '40px' }}
        >
          <option value="">Tipo</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'reps' ? 'Repeticiones' : 'Tiempo'}
            </option>
          ))}
        </select>

        {(selectedMuscle || selectedDifficulty || selectedType) && (
          <button
            onClick={clearFilters}
            className="bg-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-600"
            style={{ minHeight: '40px' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {selectedCategory && (
        <h3 className="text-lg font-semibold text-orange-500 mb-3">
          {EXERCISE_CATEGORIES[selectedCategory]}
        </h3>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredExercises.map((exercise) => (
          <button
            key={exercise.id}
            onClick={() => handleSelect(exercise)}
            className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-left hover:border-orange-500 hover:bg-gray-750 transition-colors active:bg-gray-700"
            style={{ minHeight: '80px' }}
          >
            <div className="font-medium text-white text-sm mb-1">
              {exercise.nombre}
            </div>
            <div className="flex flex-wrap gap-1">
              {exercise.musculos.slice(0, 3).map((m) => (
                <span
                  key={m}
                  className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded"
                >
                  {m}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <span className={`px-2 py-0.5 rounded ${
                exercise.dificultad === 'principiante'
                  ? 'bg-green-900 text-green-300'
                  : exercise.dificultad === 'intermedio'
                  ? 'bg-yellow-900 text-yellow-300'
                  : 'bg-red-900 text-red-300'
              }`}>
                {DIFFICULTY_LABELS[exercise.dificultad]}
              </span>
              <span>{exercise.tipo === 'reps' ? 'Repeticiones' : 'Tiempo'}</span>
              {exercise.unilateral && <span>• Unilateral</span>}
            </div>
            {exercise.estado === 'pendiente' && (
              <div className="text-xs text-gray-500 mt-1">Próximamente</div>
            )}
          </button>
        ))}
      </div>

      {filteredExercises.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          No se encontraron ejercicios con los filtros seleccionados.
        </div>
      )}
    </div>
  )
}
