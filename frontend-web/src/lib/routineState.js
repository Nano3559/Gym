export const ROUTINE_STATES = {
  IDLE: 'IDLE',
  PREPARING: 'PREPARING',
  EXERCISING: 'EXERCISING',
  RESTING: 'RESTING',
  COMPLETED: 'COMPLETED',
}

export const initialState = {
  status: ROUTINE_STATES.IDLE,
  routine: [],
  currentIndex: 0,
  currentSet: 1,
  totalSets: 1,
  targetReps: 0,
  targetDuration: 0,
  restDuration: 0,
  isPaused: false,
  preparingCountdown: 0,
  restCountdown: 0,
  completedExercises: [],
}

export function routineReducer(state, action) {
  switch (action.type) {
    case 'START_ROUTINE': {
      const { routine, metadata } = action
      if (!routine?.length) return state
      const first = routine[0]
      return {
        ...initialState,
        status: ROUTINE_STATES.PREPARING,
        routine,
        currentIndex: 0,
        currentSet: 1,
        totalSets: first.sets ?? 1,
        targetReps: first.targetReps ?? 0,
        targetDuration: first.targetDuration ?? 0,
        restDuration: first.restDuration ?? 0,
        preparingCountdown: 3,
        isPaused: false,
        routineId: metadata?.routineId ?? null,
        routineTitle: metadata?.routineTitle ?? 'Rutina personalizada',
      }
    }

    case 'TICK_PREPARING': {
      if (state.status !== ROUTINE_STATES.PREPARING || state.isPaused) return state
      if (state.preparingCountdown <= 1) {
        return {
          ...state,
          status: ROUTINE_STATES.EXERCISING,
          preparingCountdown: 0,
        }
      }
      return { ...state, preparingCountdown: state.preparingCountdown - 1 }
    }

    case 'EXERCISE_COMPLETE': {
      if (state.status !== ROUTINE_STATES.EXERCISING || state.isPaused) return state
      const entry = { exerciseId: state.routine[state.currentIndex].exerciseId,
        set: state.currentSet, reps: action.reps ?? 0, durationSec: action.durationSec ?? 0,
        ...(action.loadKg != null ? { loadKg: action.loadKg } : {}) }
      const completedExercises = [...state.completedExercises, entry]
      const isLastSet = state.currentSet >= state.totalSets
      const isLastExercise = state.currentIndex >= state.routine.length - 1

      if (isLastSet && isLastExercise) {
        return {
          ...state,
          status: ROUTINE_STATES.COMPLETED,
          completedExercises,
        }
      }

      if (isLastSet) {
        return {
          ...state,
          status: ROUTINE_STATES.RESTING,
          restCountdown: state.restDuration,
          completedExercises,
        }
      }

      return {
        ...state,
        status: ROUTINE_STATES.RESTING,
        restCountdown: state.restDuration,
        completedExercises,
      }
    }

    case 'TICK_RESTING': {
      if (state.status !== ROUTINE_STATES.RESTING || state.isPaused) return state
      if (state.restCountdown <= 1) {
        const isLastSet = state.currentSet >= state.totalSets
        if (isLastSet) {
          const nextIndex = state.currentIndex + 1
          const next = state.routine[nextIndex]
          return {
            ...state,
            status: ROUTINE_STATES.PREPARING,
            currentIndex: nextIndex,
            currentSet: 1,
            totalSets: next.sets ?? 1,
            targetReps: next.targetReps ?? 0,
            targetDuration: next.targetDuration ?? 0,
            restDuration: next.restDuration ?? 0,
            preparingCountdown: 3,
            restCountdown: 0,
          }
        }
        return {
          ...state,
          status: ROUTINE_STATES.PREPARING,
          currentSet: state.currentSet + 1,
          preparingCountdown: 3,
          restCountdown: 0,
        }
      }
      return { ...state, restCountdown: state.restCountdown - 1 }
    }

    case 'EXTEND_REST': {
      if (state.status !== ROUTINE_STATES.RESTING || state.isPaused) return state
      return { ...state, restCountdown: state.restCountdown + 10 }
    }

    case 'SKIP_REST': {
      if (state.status !== ROUTINE_STATES.RESTING || state.isPaused) return state
      const isLastSet = state.currentSet >= state.totalSets
      if (isLastSet) {
        const nextIndex = state.currentIndex + 1
        const next = state.routine[nextIndex]
        return {
          ...state,
          status: ROUTINE_STATES.PREPARING,
          currentIndex: nextIndex,
          currentSet: 1,
          totalSets: next.sets ?? 1,
          targetReps: next.targetReps ?? 0,
          targetDuration: next.targetDuration ?? 0,
          restDuration: next.restDuration ?? 0,
          preparingCountdown: 3,
          restCountdown: 0,
        }
      }
      return {
        ...state,
        status: ROUTINE_STATES.PREPARING,
        currentSet: state.currentSet + 1,
        preparingCountdown: 3,
        restCountdown: 0,
      }
    }

    case 'PAUSE':
      if (state.status === ROUTINE_STATES.IDLE || state.status === ROUTINE_STATES.COMPLETED) return state
      return { ...state, isPaused: true }

    case 'RESUME':
      if (state.status === ROUTINE_STATES.IDLE || state.status === ROUTINE_STATES.COMPLETED) return state
      return { ...state, isPaused: false }

    case 'RESET':
      return { ...initialState }

    case 'ADD_REP': {
      if (state.status !== ROUTINE_STATES.EXERCISING) return state
      return state
    }

    default:
      return state
  }
}

