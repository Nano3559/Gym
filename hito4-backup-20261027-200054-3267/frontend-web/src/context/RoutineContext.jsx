import { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from 'react'
import { saveRoutineSession } from '../services/routineService.js'

import { ROUTINE_STATES, initialState, routineReducer } from '../lib/routineState.js'
const RoutineContext = createContext(null)

export function RoutineProvider({ children }) {
  const [state, dispatch] = useReducer(routineReducer, initialState)
  const sessionSavedRef = useRef(false)
  const routineStartTimeRef = useRef(null)
  const [saveAttempt, setSaveAttempt] = useState(0)
  const [saveStatus, setSaveStatus] = useState('idle')
  useEffect(() => {
    if (state.isPaused || !['PREPARING', 'RESTING'].includes(state.status)) return
    const timer = setInterval(() => dispatch({ type: state.status === 'PREPARING' ? 'TICK_PREPARING' : 'TICK_RESTING' }), 1000)
    return () => clearInterval(timer)
  }, [state.status, state.isPaused])

  useEffect(() => {
    if (state.status === ROUTINE_STATES.PREPARING && !routineStartTimeRef.current) {
      routineStartTimeRef.current = Date.now()
    }
  }, [state.status])

  useEffect(() => {
    if (state.status === ROUTINE_STATES.COMPLETED && !sessionSavedRef.current) {
      sessionSavedRef.current = true
      const durationSec = routineStartTimeRef.current
        ? Math.round((Date.now() - routineStartTimeRef.current) / 1000)
        : 0

      setSaveStatus('saving')
      saveRoutineSession({
        routineId: state.routineId ?? null,
        routineTitle: state.routineTitle ?? 'Rutina personalizada',
        exercises: state.completedExercises,
        durationSec,
      }).then(() => setSaveStatus('saved')).catch(() => setSaveStatus('failed'))
    }

    if (state.status === ROUTINE_STATES.IDLE) {
      sessionSavedRef.current = false
      routineStartTimeRef.current = null
    }
  }, [state.status, state.completedExercises, state.routineId, state.routineTitle, saveAttempt])

  const startRoutine = useCallback((routine, metadata = {}) => {
    sessionSavedRef.current = false
    routineStartTimeRef.current = Date.now()
    setSaveStatus('idle')
    dispatch({ type: 'START_ROUTINE', routine, metadata })
  }, [])

  const pause = useCallback(() => dispatch({ type: 'PAUSE' }), [])
  const resume = useCallback(() => dispatch({ type: 'RESUME' }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])
  const skipRest = useCallback(() => dispatch({ type: 'SKIP_REST' }), [])
  const extendRest = useCallback(() => dispatch({ type: 'EXTEND_REST' }), [])
  const exerciseComplete = useCallback((reps, durationSec = 0) => dispatch({ type: 'EXERCISE_COMPLETE', reps, durationSec }), [])

  const value = {
    ...state,
    saveStatus,
    retrySave: () => { if (saveStatus === 'failed') { sessionSavedRef.current = false; setSaveAttempt(value => value + 1) } },
    startRoutine,
    pause,
    resume,
    reset,
    skipRest,
    extendRest,
    exerciseComplete,
    currentExercise: state.routine[state.currentIndex] ?? null,
    isIdle: state.status === ROUTINE_STATES.IDLE,
    isPreparing: state.status === ROUTINE_STATES.PREPARING,
    isExercising: state.status === ROUTINE_STATES.EXERCISING,
    isResting: state.status === ROUTINE_STATES.RESTING,
    isCompleted: state.status === ROUTINE_STATES.COMPLETED,
  }

  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>
}

export function useRoutine() {
  const ctx = useContext(RoutineContext)
  if (!ctx) throw new Error('useRoutine debe usarse dentro de RoutineProvider')
  return ctx
}
