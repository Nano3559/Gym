import { useCallback, useEffect, useReducer, useRef } from 'react'

// Estados posibles (Model).
export const PAYMENT_STATUS = {
  IDLE: 'IDLE',
  GENERATING_QR: 'GENERATING_QR',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
}

// Acciones (Intent).
const ACTIONS = {
  INIT_PAYMENT: 'INIT_PAYMENT',
  QR_GENERATED: 'QR_GENERATED',
  SIMULATE_PAYMENT_SUCCESS: 'SIMULATE_PAYMENT_SUCCESS',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  SET_ERROR: 'SET_ERROR',
  RESET: 'RESET',
}

const initialState = {
  status: PAYMENT_STATUS.IDLE,
  user: null,
  plan: null,
  transactionId: null,
  qrPayload: null,
  membership: null,
  error: null,
}

// Transiciones válidas: cada estado solo puede derivar a los permitidos.
const TRANSITIONS = {
  [PAYMENT_STATUS.IDLE]: new Set([ACTIONS.INIT_PAYMENT]),
  [PAYMENT_STATUS.GENERATING_QR]: new Set([ACTIONS.QR_GENERATED, ACTIONS.SET_ERROR]),
  [PAYMENT_STATUS.AWAITING_PAYMENT]: new Set([ACTIONS.SIMULATE_PAYMENT_SUCCESS, ACTIONS.SET_ERROR]),
  [PAYMENT_STATUS.PROCESSING]: new Set([ACTIONS.PAYMENT_COMPLETED, ACTIONS.SET_ERROR]),
  [PAYMENT_STATUS.SUCCESS]: new Set([ACTIONS.RESET]),
  [PAYMENT_STATUS.ERROR]: new Set([ACTIONS.RESET]),
}

function reducer(state, action) {
  const { status } = state
  const allowed = TRANSITIONS[status] || new Set()

  // Máquina de estados estricta: transiciones no permitidas se ignoran.
  if (!allowed.has(action.type)) return state

  switch (action.type) {
    case ACTIONS.INIT_PAYMENT:
      return {
        ...initialState,
        status: PAYMENT_STATUS.GENERATING_QR,
        user: action.user,
        plan: action.plan,
      }

    case ACTIONS.QR_GENERATED:
      return {
        ...state,
        status: PAYMENT_STATUS.AWAITING_PAYMENT,
        transactionId: action.transactionId,
        qrPayload: action.qrPayload,
      }

    case ACTIONS.SIMULATE_PAYMENT_SUCCESS:
      return { ...state, status: PAYMENT_STATUS.PROCESSING }

    case ACTIONS.PAYMENT_COMPLETED:
      return {
        ...state,
        status: PAYMENT_STATUS.SUCCESS,
        membership: action.membership || null,
      }

    case ACTIONS.SET_ERROR:
      return { ...state, status: PAYMENT_STATUS.ERROR, error: action.error }

    case ACTIONS.RESET:
      return { ...initialState }

    default:
      return state
  }
}

/**
 * Hook con patrón MVI (Model-View-Intent) para el flujo de pago.
 * - Model: estados estrictos del pago (useReducer).
 * - Intent: acciones que disparan transiciones.
 * - View: estado expuesto + funciones de disparo.
 *
 * El control idempotente impide reintentos: una vez que se entra a 'PROCESSING'
 * las acciones que disparan confirmación se bloquean hasta RESET.
 */
export default function usePaymentMVI() {
  const [state, dispatch] = useReducer(reducer, initialState)
  // Ref de control idempotente a nivel de vista (protección adicional frente a
  // clics repetidos incluso antes de que el reducer procese la transición).
  const processingRef = useRef(false)

  // Asegura que el ref refleje el estado PROCESSING.
  useEffect(() => {
    processingRef.current = state.status === PAYMENT_STATUS.PROCESSING
  }, [state.status])

  /** Dispara el flujo de pago para un usuario y plan. */
  const initPayment = useCallback((user, plan) => {
    dispatch({ type: ACTIONS.INIT_PAYMENT, user, plan })
  }, [])

  /** Notifica que el QR fue generado (interna, tras crear el payload). */
  const qrGenerated = useCallback((transactionId, qrPayload) => {
    dispatch({ type: ACTIONS.QR_GENERATED, transactionId, qrPayload })
  }, [])

  /**
   * Simula la confirmación del pago. Mientras el estado sea PROCESSING (o el
   * ref esté activo), ignora llamadas repetidas: previene doble cobro.
   */
  const simulatePaymentSuccess = useCallback(() => {
    if (state.status !== PAYMENT_STATUS.AWAITING_PAYMENT || processingRef.current) return
    processingRef.current = true
    dispatch({ type: ACTIONS.SIMULATE_PAYMENT_SUCCESS })
  }, [state.status])

  /** Notifica que la confirmación terminó con éxito (interna). */
  const paymentCompleted = useCallback((membership) => {
    dispatch({ type: ACTIONS.PAYMENT_COMPLETED, membership })
  }, [])

  /** Registra un error en el flujo. */
  const setError = useCallback((error) => {
    dispatch({ type: ACTIONS.SET_ERROR, error })
  }, [])

  /** Reinicia la máquina de estados a IDLE. */
  const reset = useCallback(() => {
    processingRef.current = false
    dispatch({ type: ACTIONS.RESET })
  }, [])

  return {
    ...state,
    status: state.status,
    canSimulate: state.status === PAYMENT_STATUS.AWAITING_PAYMENT,
    initPayment,
    qrGenerated,
    simulatePaymentSuccess,
    paymentCompleted,
    setError,
    reset,
  }
}