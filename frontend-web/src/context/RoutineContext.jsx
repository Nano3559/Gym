import { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from 'react'
import { saveRoutineSession } from '../services/routineService.js'
import { createSessionClock } from '../lib/trackingData.js'
import { localDay } from '../lib/progressData.js'

import { ROUTINE_STATES, initialState, routineReducer } from '../lib/routineState.js'
const RoutineContext = createContext(null)

export function RoutineProvider({ children, userId }) {
  const [state, dispatch] = useReducer(routineReducer, initialState)
  const sessionSavedRef = useRef(false)
  const routineStartTimeRef = useRef(null)
  const clockRef = useRef(null)
  const operationRef = useRef(null)
  const payloadRef = useRef(null)
  const setActiveStartRef = useRef(0)
  const intensityRef = useRef(null)
  const [saveAttempt, setSaveAttempt] = useState(0)
  const [saveStatus, setSaveStatus] = useState('idle')
  useEffect(() => {
    clockRef.current?.transition(state.isPaused ? 'paused' : ({ PREPARING: 'preparation', RESTING: 'rest', EXERCISING: 'active' }[state.status] ?? null))
  }, [state.status, state.isPaused])

  const sessionPayload = useCallback((sessionStatus, finalEntry) => {
    if (payloadRef.current) return payloadRef.current
    const seconds = clockRef.current?.snapshot() || { active: 0, rest: 0, preparation: 0, paused: 0 }
    const started = routineStartTimeRef.current || Date.now(), ended = Date.now()
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const entries = finalEntry ? [...state.completedExercises, finalEntry] : state.completedExercises
    payloadRef.current = { expectedUserId: userId, routineId: state.routineId ?? null, routineTitle: state.routineTitle ?? 'Rutina personalizada', exercises: entries,
      durationSec: Math.max(Math.ceil((ended - started) / 1000), seconds.active + seconds.rest + seconds.preparation + seconds.paused),
      tracking: { operation_id: operationRef.current, started_at: new Date(started).toISOString(), completed_at: new Date(ended).toISOString(),
        timezone: zone, local_date: localDay(started,zone), session_status: sessionStatus,
        active_sec: seconds.active, rest_sec: seconds.rest, preparation_sec: seconds.preparation, paused_sec: seconds.paused,
        intensity: intensityRef.current } }
    return payloadRef.current
  }, [state.completedExercises, state.routineId, state.routineTitle, userId])
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
      setSaveStatus('saving')
      saveRoutineSession(sessionPayload('completed')).then(() => setSaveStatus('saved')).catch(() => setSaveStatus('failed'))
    }

    if (state.status === ROUTINE_STATES.IDLE) {
      sessionSavedRef.current = false
      routineStartTimeRef.current = null
    }
  }, [state.status, state.completedExercises, state.routineId, state.routineTitle, saveAttempt, sessionPayload])

  const startRoutine = useCallback((routine, metadata = {}) => {
    sessionSavedRef.current = false
    routineStartTimeRef.current = Date.now()
    clockRef.current = createSessionClock()
    operationRef.current = crypto.randomUUID()
    payloadRef.current = null
    setActiveStartRef.current = 0
    intensityRef.current = null
    setSaveStatus('idle')
    dispatch({ type: 'START_ROUTINE', routine, metadata })
  }, [])

  const pause = useCallback(() => { clockRef.current?.transition('paused'); dispatch({ type: 'PAUSE' }) }, [])
  useEffect(() => {
    const hide = () => { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [pause])
  const resume = useCallback(() => dispatch({ type: 'RESUME' }), [])
  const reset = useCallback(() => { clockRef.current?.transition(null); dispatch({ type: 'RESET' }) }, [])
  const skipRest = useCallback(() => dispatch({ type: 'SKIP_REST' }), [])
  const extendRest = useCallback(() => dispatch({ type: 'EXTEND_REST' }), [])
  const exerciseComplete = useCallback((reps, durationSec = 0, loadKg = null) => {
    const active = clockRef.current?.snapshot().active || 0
    const elapsed = Math.max(0, active - setActiveStartRef.current)
    setActiveStartRef.current = active
    dispatch({ type: 'EXERCISE_COMPLETE', reps, durationSec: Math.max(durationSec,elapsed), loadKg })
  }, [])

  const savePartial = async (reps, loadKg) => {
    clockRef.current?.transition(null)
    const seconds = clockRef.current?.snapshot()
    const currentSeconds = Math.max(0,(seconds?.active || 0) - setActiveStartRef.current)
    const finalEntry = state.status === 'EXERCISING' && currentSeconds > 0 ? {
      exerciseId: state.routine[state.currentIndex]?.exerciseId, set: state.currentSet, reps, durationSec: currentSeconds, loadKg,
      partial: true,
    } : null
    setSaveStatus('saving')
    try { await saveRoutineSession(sessionPayload('partial',finalEntry)); setSaveStatus('saved'); return true }
    catch { setSaveStatus('failed'); return false }
  }

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
    savePartial,
    setSessionIntensity: value => { intensityRef.current = value || null },
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
